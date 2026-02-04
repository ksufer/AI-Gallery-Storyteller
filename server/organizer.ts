import fs from 'fs/promises';
import path from 'path';
import { getImages, upsertImage, deleteImage, getImageByPath } from './db.ts';
import { parseImageFile } from './metadata.ts';

// Helper to check if directory is a date folder (YYYY-MM-DD)
const isDateFolder = (name: string) => /^\d{4}-\d{2}-\d{2}$/.test(name);

export const organizeUploads = async (uploadsDir: string) => {
    try {
        await processDirectory(uploadsDir, uploadsDir);
    } catch (error) {
        console.error("Error organizing uploads:", error);
    }
};

const processDirectory = async (currentDir: string, rootUploadsDir: string) => {
    try {
        const files = await fs.readdir(currentDir, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(currentDir, file.name);

            if (file.isDirectory()) {
                // Check if it is a date folder in the root directory
                // We want to skip processing inside the destination folders to avoid loops or redundant work
                if (currentDir === rootUploadsDir && isDateFolder(file.name)) {
                    continue;
                }

                // Recurse into subdirectories
                await processDirectory(fullPath, rootUploadsDir);

                // Attempt to remove empty directory (cleanup) after processing
                try {
                    const remaining = await fs.readdir(fullPath);
                    if (remaining.length === 0) {
                        await fs.rmdir(fullPath);
                        console.log(`Removed empty directory: ${fullPath}`);
                    }
                } catch (e) {
                    // Ignore if not empty or other error
                }

            } else if (file.isFile() && isImageFile(file.name)) {
                // Process Image
                await moveImage(fullPath, rootUploadsDir, file.name);
            }
        }
    } catch (error) {
        console.error(`Error processing directory ${currentDir}:`, error);
    }
};

const moveImage = async (filePath: string, uploadsDir: string, fileName: string) => {
    try {
        const stats = await fs.stat(filePath);
        const date = new Date(stats.mtime);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const targetDir = path.join(uploadsDir, dateStr);

        // Ensure target dir exists
        try {
            await fs.access(targetDir);
        } catch {
            await fs.mkdir(targetDir, { recursive: true });
        }

        // Check if file is already in the correct directory
        // normalize paths to be safe
        const normalizedFilePath = path.normalize(filePath);
        const normalizedTargetDir = path.normalize(targetDir);
        
        if (path.dirname(normalizedFilePath) === normalizedTargetDir) {
            return; 
        }

        // Get safe filename
        const safeName = await getSafeFileName(targetDir, fileName);
        const targetPath = path.join(targetDir, safeName);

        // Move
        await fs.rename(filePath, targetPath);
        console.log(`Moved ${fileName} to ${dateStr}/${safeName}`);
    } catch (error) {
        console.error(`Error moving file ${filePath}:`, error);
    }
};

const isImageFile = (filename: string): boolean => {
    const ext = path.extname(filename).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
};

/**
 * Generates a safe filename that avoids collisions by appending a counter if needed
 * @param targetDir - The directory where the file will be saved
 * @param originalName - The original filename
 * @returns A unique filename that doesn't exist in the target directory
 */
export const getSafeFileName = async (targetDir: string, originalName: string): Promise<string> => {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    let counter = 0;
    let safeName = originalName;
    
    while (true) {
        const testPath = path.join(targetDir, safeName);
        try {
            await fs.access(testPath);
            // File exists, try with counter
            counter++;
            safeName = `${baseName}_${counter}${ext}`;
        } catch {
            // File doesn't exist, this name is safe
            return safeName;
        }
    }
};

export const getAllImages = async (dir: string): Promise<string[]> => {
    let results: string[] = [];
    const list = await fs.readdir(dir, { withFileTypes: true });
    
    for (const file of list) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
            const subResults = await getAllImages(filePath);
            results = results.concat(subResults);
        } else if (isImageFile(file.name)) {
            results.push(filePath);
        }
    }
    
    return results;
};

export type SyncResult = { added: number; removed: number };

/**
 * 将磁盘上的图片与数据库记录同步（增删）。
 * @param uploadsDir - 上传目录
 * @param opts.quiet - 为 true 时不输出 "Syncing..." / "Sync complete."，仅返回统计（用于周期任务）
 * @returns 本次同步新增与删除的数量
 */
export const syncImagesWithDb = async (
    uploadsDir: string,
    opts?: { quiet?: boolean }
): Promise<SyncResult> => {
    const quiet = opts?.quiet ?? false;
    if (!quiet) console.log("Syncing images with database...");

    // 1. Get all files on disk
    const fsPaths = await getAllImages(uploadsDir);
    const fsPathSet = new Set(fsPaths);

    // 2. Get all images in DB
    const dbImages = getImages() as any[];
    const dbPathMap = new Map<string, string>(); // path -> id
    dbImages.forEach(img => dbPathMap.set(img.file_path, img.id));

    let removed = 0;
    // 3. Identify removed files
    for (const [dbPath, dbId] of dbPathMap) {
        if (!fsPathSet.has(dbPath)) {
            if (!quiet) console.log(`Removing missing file from DB: ${dbPath}`);
            deleteImage(dbId);
            removed++;
        }
    }

    let added = 0;
    // 4. Identify added files
    for (const fsPath of fsPaths) {
        if (!dbPathMap.has(fsPath)) {
            if (!quiet) console.log(`Adding new file to DB: ${fsPath}`);
            try {
                const stats = await fs.stat(fsPath);
                const metadata = await parseImageFile(fsPath);
                const uniqueId = path.basename(fsPath) + '_' + stats.mtime.getTime();
                upsertImage(uniqueId, fsPath, stats.mtime.toISOString(), metadata);
                added++;
            } catch (err) {
                console.error(`Failed to parse ${fsPath}:`, err);
            }
        }
    }

    if (!quiet) console.log("Sync complete.");
    return { added, removed };
};
