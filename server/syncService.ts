import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
    getSyncSourceById,
    getSyncRecordBySourceAndHash,
    upsertSyncRecord,
    createSyncTask,
    updateSyncTaskProgress,
    getActiveSyncTaskBySourceId,
    updateSyncSource,
} from './db.ts';
import { getSafeFileName } from './organizer.ts';
import { parseImageFile } from './metadata.ts';
import { upsertImage } from './db.ts';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

function isImageFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

export interface ScanOptions {
    fromDate?: string; // YYYY-MM-DD
    toDate?: string;  // YYYY-MM-DD
}

export interface ScanEntry {
    path: string;
    mtime: Date;
    size: number;
}

/**
 * Validates source path: must exist, be readable, and not be under uploads dir.
 * @returns Resolved absolute path (realpath).
 */
export async function validateSourcePath(sourcePath: string, uploadsDir: string): Promise<string> {
    const resolved = path.resolve(sourcePath);
    const real = path.normalize(fsSync.realpathSync(resolved));
    const uploadsNormalized = path.normalize(path.resolve(uploadsDir));
    if (real === uploadsNormalized || real.startsWith(uploadsNormalized + path.sep)) {
        throw new Error('Source path cannot be inside the uploads directory');
    }
    await fs.access(real);
    return real;
}

/**
 * Recursively scan directory for image files, optionally filtered by mtime range.
 */
export async function scanSourceDirectory(sourcePath: string, options: ScanOptions = {}): Promise<ScanEntry[]> {
    const results: ScanEntry[] = [];
    const fromDate = options.fromDate ? new Date(options.fromDate) : null;
    const toDate = options.toDate ? new Date(options.toDate) : null;

    async function walk(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile() && isImageFile(entry.name)) {
                try {
                    const stats = await fs.stat(fullPath);
                    const mtime = stats.mtime;
                    if (fromDate && mtime < fromDate) continue;
                    if (toDate && mtime > toDate) continue;
                    results.push({ path: fullPath, mtime, size: stats.size });
                } catch (e) {
                    // Skip files we can't stat
                }
            }
        }
    }

    await walk(sourcePath);
    return results;
}

/**
 * Compute SHA-256 hash of file using streaming to avoid loading into memory.
 */
export function computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fsSync.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

/** In-memory state for pause/cancel and progress (used by SSE). */
const runState = new Map<number, { paused: boolean; cancel: boolean }>();
const progressState = new Map<number, {
    status: string;
    processedFiles: number;
    totalFiles: number;
    copiedSize: number;
    totalSize: number;
    logLines: string[];
}>();

export function getSyncRunState(sourceId: number) {
    return runState.get(sourceId);
}

export function setSyncRunState(sourceId: number, state: { paused: boolean; cancel: boolean }) {
    runState.set(sourceId, state);
}

export function getSyncProgress(sourceId: number) {
    return progressState.get(sourceId);
}

export function setSyncProgress(sourceId: number, progress: {
    status: string;
    processedFiles: number;
    totalFiles: number;
    copiedSize: number;
    totalSize: number;
    logLines: string[];
}) {
    progressState.set(sourceId, progress);
}

function appendLog(sourceId: number, line: string) {
    const p = progressState.get(sourceId);
    if (!p) return;
    p.logLines.push(line);
    if (p.logLines.length > 100) p.logLines.shift();
}

function yieldLoop(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
}

const BATCH_SIZE = 50;

/**
 * Run sync for a source: scan, filter by sync_records (skip deleted; skip already copied if target exists), copy in batches, upsert images.
 */
export async function runSync(sourceId: number, uploadsDir: string): Promise<void> {
    const source = getSyncSourceById(sourceId);
    if (!source) {
        throw new Error('Sync source not found');
    }
    if (getActiveSyncTaskBySourceId(sourceId)) {
        throw new Error('A sync task is already running for this source');
    }

    const sourcePath = path.resolve(source.path);
    await validateSourcePath(sourcePath, uploadsDir);

    const fromDate = source.from_date ?? undefined;
    const toDate = source.to_date ?? undefined;
    const scanList = await scanSourceDirectory(sourcePath, { fromDate, toDate });

    // Build list of files to process: compute hash and check sync_records
    const toCopy: { path: string; mtime: Date; size: number; hash: string }[] = [];
    const seenHashes = new Set<string>();
    let totalSize = 0;
    for (let i = 0; i < scanList.length; i++) {
        const entry = scanList[i];
        try {
            const hash = await computeFileHash(entry.path);
            const record = getSyncRecordBySourceAndHash(sourceId, hash);
            if (record?.status === 'deleted') continue;
            if (record?.status === 'copied' && record.target_path) {
                try {
                    await fs.access(record.target_path);
                    continue; // already copied and file exists
                } catch {
                    // target missing, re-copy
                }
            }
            if (seenHashes.has(hash)) continue; // same content already in this run (e.g. symlinks/duplicates)
            seenHashes.add(hash);
            toCopy.push({ path: entry.path, mtime: entry.mtime, size: entry.size, hash });
            totalSize += entry.size;
        } catch (e) {
            appendLog(sourceId, `Skip (hash error): ${entry.path}`);
        }
    }

    const taskId = createSyncTask(sourceId, toCopy.length, totalSize);
    runState.set(sourceId, { paused: false, cancel: false });
    setSyncProgress(sourceId, {
        status: 'running',
        processedFiles: 0,
        totalFiles: toCopy.length,
        copiedSize: 0,
        totalSize,
        logLines: [],
    });
    appendLog(sourceId, `Sync started: ${toCopy.length} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    let processedFiles = 0;
    let copiedSize = 0;

    try {
        for (let i = 0; i < toCopy.length; i += BATCH_SIZE) {
            const state = runState.get(sourceId);
            if (state?.cancel) {
                appendLog(sourceId, 'Sync cancelled.');
                break;
            }
            while (state?.paused && !state?.cancel) {
                setSyncProgress(sourceId, {
                    ...progressState.get(sourceId)!,
                    status: 'paused',
                });
                await new Promise((r) => setTimeout(r, 500));
            }

            const batch = toCopy.slice(i, i + BATCH_SIZE);
            for (const item of batch) {
                try {
                    const dateStr = item.mtime.toISOString().split('T')[0];
                    const targetDir = path.join(uploadsDir, dateStr);
                    await fs.mkdir(targetDir, { recursive: true });
                    const baseName = path.basename(item.path);
                    const safeName = await getSafeFileName(targetDir, baseName);
                    const targetPath = path.join(targetDir, safeName);
                    await fs.copyFile(item.path, targetPath);

                    upsertSyncRecord({
                        sourceId,
                        sourcePath: item.path,
                        fileHash: item.hash,
                        fileSize: item.size,
                        fileMtime: item.mtime.toISOString(),
                        targetPath,
                        status: 'copied',
                    });

                    const metadata = await parseImageFile(targetPath);
                    const uniqueId = path.basename(targetPath) + '_' + item.mtime.getTime();
                    upsertImage(uniqueId, targetPath, item.mtime.toISOString(), metadata);

                    copiedSize += item.size;
                    processedFiles++;
                } catch (err: any) {
                    upsertSyncRecord({
                        sourceId,
                        sourcePath: item.path,
                        fileHash: item.hash,
                        fileSize: item.size,
                        fileMtime: item.mtime.toISOString(),
                        status: 'failed',
                        errorMessage: err?.message ?? String(err),
                    });
                    appendLog(sourceId, `Failed: ${item.path} - ${err?.message ?? err}`);
                }
            }

            updateSyncTaskProgress(taskId, { processedFiles, copiedSize });
            const prog = progressState.get(sourceId);
            if (prog) {
                prog.processedFiles = processedFiles;
                prog.copiedSize = copiedSize;
            }
            await yieldLoop();
        }

        const finalStatus = runState.get(sourceId)?.cancel ? 'cancelled' : 'completed';
        updateSyncTaskProgress(taskId, { processedFiles, copiedSize, status: finalStatus });
        setSyncProgress(sourceId, {
            ...progressState.get(sourceId)!,
            status: finalStatus,
            processedFiles,
            copiedSize,
        });
        updateSyncSource(sourceId, { lastSyncAt: new Date().toISOString() });
        appendLog(sourceId, `Sync ${finalStatus}: ${processedFiles} files.`);
    } catch (err: any) {
        updateSyncTaskProgress(taskId, { processedFiles, copiedSize, status: 'failed' });
        setSyncProgress(sourceId, {
            ...progressState.get(sourceId)!,
            status: 'failed',
        });
        appendLog(sourceId, `Sync failed: ${err?.message ?? err}`);
        throw err;
    } finally {
        runState.delete(sourceId);
    }
}
