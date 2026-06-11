import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load blocked tags configuration
let BLOCKED_PATTERNS: RegExp[] = [];

export const loadBlockedTags = () => {
    try {
        const configPath = path.resolve(__dirname, '../config/blocked-tags.json');
        const content = fs.readFileSync(configPath, 'utf-8');
        const tags = JSON.parse(content) as string[];
        
        BLOCKED_PATTERNS = tags
            .filter(t => t && t.trim().length > 0)
            .map(t => {
                try {
                    // Create case-insensitive regex for the pattern
                    // We treat the input as a regex pattern directly
                    return new RegExp(t, 'i');
                } catch (e) {
                    console.warn(`⚠ Invalid blocked tag regex pattern: "${t}"`, e);
                    return null;
                }
            })
            .filter((p): p is RegExp => p !== null);
            
        console.log(`✓ Loaded ${BLOCKED_PATTERNS.length} blocked tag patterns`);
        return true;
    } catch (error) {
        console.warn('⚠ Could not load blocked-tags.json, using empty blocklist');
        BLOCKED_PATTERNS = [];
        return false;
    }
};

// Load on module initialization
loadBlockedTags();

// Ensure db directory exists
const dbDir = path.resolve(__dirname, '../db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const dbPath = path.join(dbDir, 'images.db');
const db = new Database(dbPath);
// db.pragma('journal_mode = WAL'); // Optional for performance

export const initDb = () => {
    // Images table
    db.exec(`
        CREATE TABLE IF NOT EXISTS images (
            id TEXT PRIMARY KEY,
            file_path TEXT UNIQUE NOT NULL,
            date_added TEXT,
            meta_json TEXT,
            story TEXT
        )
    `);

    // Add story column if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE images ADD COLUMN story TEXT`);
    } catch (e) {
        // Column probably exists, ignore
    }

    // Add is_favorite column if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE images ADD COLUMN is_favorite INTEGER DEFAULT 0`);
    } catch (e) {
        // Column probably exists, ignore
    }

    // Tags table
    db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    `);

    // Junction table with source field
    db.exec(`
        CREATE TABLE IF NOT EXISTS image_tags (
            image_id TEXT,
            tag_id INTEGER,
            source TEXT DEFAULT 'auto',
            PRIMARY KEY (image_id, tag_id),
            FOREIGN KEY(image_id) REFERENCES images(id) ON DELETE CASCADE,
            FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
    `);

    // Add source column to image_tags if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE image_tags ADD COLUMN source TEXT DEFAULT 'auto'`);
    } catch (e) {
        // Column probably exists, ignore
    }

    // Sync sources table
    db.exec(`
        CREATE TABLE IF NOT EXISTS sync_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            enabled INTEGER DEFAULT 1,
            last_sync_at TEXT,
            auto_sync INTEGER DEFAULT 0,
            sync_interval INTEGER DEFAULT 3600,
            from_date TEXT,
            to_date TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // Sync records table
    db.exec(`
        CREATE TABLE IF NOT EXISTS sync_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL,
            source_path TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            file_size INTEGER,
            file_mtime TEXT,
            target_path TEXT,
            status TEXT DEFAULT 'copied',
            copied_at TEXT,
            error_message TEXT,
            FOREIGN KEY (source_id) REFERENCES sync_sources(id) ON DELETE CASCADE,
            UNIQUE(source_id, file_hash)
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_records_hash ON sync_records(file_hash)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_records_status ON sync_records(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_records_target_path ON sync_records(target_path)`);

    // Sync tasks table
    db.exec(`
        CREATE TABLE IF NOT EXISTS sync_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            total_files INTEGER DEFAULT 0,
            processed_files INTEGER DEFAULT 0,
            total_size INTEGER DEFAULT 0,
            copied_size INTEGER DEFAULT 0,
            started_at TEXT,
            completed_at TEXT,
            FOREIGN KEY (source_id) REFERENCES sync_sources(id) ON DELETE CASCADE
        )
    `);
};

// Initialize DB tables before preparing statements
initDb();

// Statements
// Use ON CONFLICT DO UPDATE to preserve other fields like story
const upsertImageStmt = db.prepare(`
    INSERT INTO images (id, file_path, date_added, meta_json)
    VALUES (@id, @filePath, @dateAdded, @metaJson)
    ON CONFLICT(id) DO UPDATE SET
        file_path = excluded.file_path,
        date_added = excluded.date_added,
        meta_json = excluded.meta_json
`);

const insertTag = db.prepare(`
    INSERT OR IGNORE INTO tags (name) VALUES (?)
`);

const getTagId = db.prepare(`
    SELECT id FROM tags WHERE name = ?
`);

const insertImageTag = db.prepare(`
    INSERT OR IGNORE INTO image_tags (image_id, tag_id, source) VALUES (?, ?, ?)
`);

const deleteImageTags = db.prepare(`
    DELETE FROM image_tags WHERE image_id = ?
`);

const deleteImageStmt = db.prepare(`
    DELETE FROM images WHERE id = ?
`);

const updateStoryStmt = db.prepare(`
    UPDATE images SET story = ? WHERE id = ?
`);

const updateFavoriteStmt = db.prepare(`
    UPDATE images SET is_favorite = ? WHERE id = ?
`);

export const upsertImage = (id: string, filePath: string, dateAdded: string, meta: any) => {
    const metaJson = JSON.stringify(meta);
    
    const transaction = db.transaction(() => {
        upsertImageStmt.run({ id, filePath, dateAdded, metaJson });
        
        // Handle tags
        deleteImageTags.run(id);
        
        const prompts = meta.prompts || [];
        const tagsToInsert = new Set<string>();
        
        prompts.forEach((p: string) => {
            const parts = p.split(',');
            parts.forEach(part => {
                const t = part.trim();
                // Filter out blocked tags and apply length constraints
                // Check if the tag matches any of the blocked patterns
                const isBlocked = BLOCKED_PATTERNS.some(pattern => pattern.test(t));
                
                if (t.length > 0 && t.length < 50 && !isBlocked) {
                    tagsToInsert.add(t);
                }
            });
        });
        
        for (const tag of tagsToInsert) {
            insertTag.run(tag);
            const tagRow = getTagId.get(tag) as { id: number };
            if (tagRow) {
                insertImageTag.run(id, tagRow.id, 'auto');
            }
        }
    });
    
    transaction();
};

export const deleteImage = (id: string) => {
    deleteImageStmt.run(id);
};

export const updateImageStory = (id: string, story: string) => {
    updateStoryStmt.run(story, id);
};

export const updateImageFavorite = (id: string, isFavorite: boolean) => {
    updateFavoriteStmt.run(isFavorite ? 1 : 0, id);
};

export const getImages = () => {
    return db.prepare('SELECT * FROM images ORDER BY date_added DESC').all();
};

export const getFavoriteImages = () => {
    return db.prepare('SELECT * FROM images WHERE is_favorite = 1 ORDER BY date_added DESC').all();
};

export const getImagesByTag = (tagName: string) => {
    return db.prepare(`
        SELECT DISTINCT i.* FROM images i
        JOIN image_tags it ON i.id = it.image_id
        JOIN tags t ON it.tag_id = t.id
        WHERE t.name = ?
        ORDER BY i.date_added DESC
    `).all(tagName);
};

export const getImageTags = (imageId: string) => {
    const tags = db.prepare(`
        SELECT t.name FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        WHERE it.image_id = ?
    `).all(imageId).map((row: any) => row.name);

    // Filter out blocked tags at read time as well
    return tags.filter((tagName: string) => 
        !BLOCKED_PATTERNS.some(pattern => pattern.test(tagName))
    );
};

export const getTagsWithCount = (search?: string, source?: 'auto' | 'user') => {
    let query = `
        SELECT t.name, COUNT(DISTINCT it.image_id) as count
        FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (search) {
        conditions.push(`t.name LIKE ?`);
        params.push(`%${search}%`);
    }
    
    if (source) {
        conditions.push(`it.source = ?`);
        params.push(source);
    }
    
    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY t.id ORDER BY count DESC`;
    
    const results = db.prepare(query).all(...params) as { name: string; count: number }[];

    // Filter out blocked tags from the results
    return results.filter(row => 
        !BLOCKED_PATTERNS.some(pattern => pattern.test(row.name))
    );
};

export const getImageByPath = (filePath: string) => {
    return db.prepare('SELECT * FROM images WHERE file_path = ?').get(filePath);
};

export const getImageById = (id: string) => {
    return db.prepare('SELECT * FROM images WHERE id = ?').get(id);
};

// Tag management functions
const deleteImageTagStmt = db.prepare(`
    DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?
`);

export const addTagToImage = (imageId: string, tagName: string) => {
    const transaction = db.transaction(() => {
        insertTag.run(tagName);
        const tagRow = getTagId.get(tagName) as { id: number } | undefined;
        if (tagRow) {
            insertImageTag.run(imageId, tagRow.id, 'user');
        }
    });
    transaction();
};

export const removeTagFromImage = (imageId: string, tagName: string) => {
    const tagRow = getTagId.get(tagName) as { id: number } | undefined;
    if (tagRow) {
        deleteImageTagStmt.run(imageId, tagRow.id);
    }
};

// ============ Sync sources ============
export const createSyncSource = (name: string, sourcePath: string, options?: { fromDate?: string; toDate?: string; autoSync?: boolean; syncInterval?: number }) => {
    const stmt = db.prepare(`
        INSERT INTO sync_sources (name, path, from_date, to_date, auto_sync, sync_interval)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
        name,
        sourcePath,
        options?.fromDate ?? null,
        options?.toDate ?? null,
        options?.autoSync ? 1 : 0,
        options?.syncInterval ?? 3600
    );
    return info.lastInsertRowid as number;
};

export const getSyncSources = () => {
    return db.prepare('SELECT * FROM sync_sources ORDER BY id ASC').all() as SyncSourceRow[];
};

export const getSyncSourceById = (id: number) => {
    return db.prepare('SELECT * FROM sync_sources WHERE id = ?').get(id) as SyncSourceRow | undefined;
};

export const updateSyncSource = (id: number, updates: { name?: string; path?: string; enabled?: boolean; lastSyncAt?: string; autoSync?: boolean; syncInterval?: number; fromDate?: string | null; toDate?: string | null }) => {
    const row = getSyncSourceById(id);
    if (!row) return;
    const name = updates.name ?? row.name;
    const pathVal = updates.path ?? row.path;
    const enabled = updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : row.enabled;
    const lastSyncAt = updates.lastSyncAt !== undefined ? updates.lastSyncAt : row.last_sync_at;
    const autoSync = updates.autoSync !== undefined ? (updates.autoSync ? 1 : 0) : row.auto_sync;
    const syncInterval = updates.syncInterval ?? row.sync_interval;
    const fromDate = updates.fromDate !== undefined ? updates.fromDate : row.from_date;
    const toDate = updates.toDate !== undefined ? updates.toDate : row.to_date;
    db.prepare(`
        UPDATE sync_sources SET name = ?, path = ?, enabled = ?, last_sync_at = ?, auto_sync = ?, sync_interval = ?, from_date = ?, to_date = ?
        WHERE id = ?
    `).run(name, pathVal, enabled, lastSyncAt, autoSync, syncInterval, fromDate, toDate, id);
};

export const deleteSyncSource = (id: number) => {
    db.prepare('DELETE FROM sync_sources WHERE id = ?').run(id);
};

// ============ Sync records ============
export const getSyncRecordsBySourceId = (sourceId: number) => {
    return db.prepare('SELECT * FROM sync_records WHERE source_id = ?').all(sourceId) as SyncRecordRow[];
};

export const getSyncRecordBySourceAndHash = (sourceId: number, fileHash: string) => {
    return db.prepare('SELECT * FROM sync_records WHERE source_id = ? AND file_hash = ?').get(sourceId, fileHash) as SyncRecordRow | undefined;
};

export const upsertSyncRecord = (record: {
    sourceId: number;
    sourcePath: string;
    fileHash: string;
    fileSize?: number;
    fileMtime?: string;
    targetPath?: string;
    status?: string;
    errorMessage?: string;
}) => {
    const copiedAt = record.status === 'copied' || record.status === 'failed' ? new Date().toISOString() : null;
    db.prepare(`
        INSERT INTO sync_records (source_id, source_path, file_hash, file_size, file_mtime, target_path, status, copied_at, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_id, file_hash) DO UPDATE SET
            source_path = excluded.source_path,
            file_size = excluded.file_size,
            file_mtime = excluded.file_mtime,
            target_path = excluded.target_path,
            status = excluded.status,
            copied_at = excluded.copied_at,
            error_message = excluded.error_message
    `).run(
        record.sourceId,
        record.sourcePath,
        record.fileHash,
        record.fileSize ?? null,
        record.fileMtime ?? null,
        record.targetPath ?? null,
        record.status ?? 'copied',
        copiedAt,
        record.errorMessage ?? null
    );
};

export const markSyncRecordDeletedByFilePath = (filePath: string) => {
    db.prepare("UPDATE sync_records SET status = 'deleted' WHERE target_path = ?").run(filePath);
};

export const resetDeletedRecordsBySourceId = (sourceId: number) => {
    db.prepare("DELETE FROM sync_records WHERE source_id = ? AND status = 'deleted'").run(sourceId);
};

// ============ Sync tasks ============
export const createSyncTask = (sourceId: number, totalFiles: number, totalSize: number) => {
    const info = db.prepare(`
        INSERT INTO sync_tasks (source_id, status, total_files, total_size, started_at)
        VALUES (?, 'running', ?, ?, datetime('now'))
    `).run(sourceId, totalFiles, totalSize);
    return info.lastInsertRowid as number;
};

export const updateSyncTaskProgress = (taskId: number, updates: { processedFiles?: number; copiedSize?: number; status?: string }) => {
    const row = db.prepare('SELECT * FROM sync_tasks WHERE id = ?').get(taskId) as SyncTaskRow | undefined;
    if (!row) return;
    const processedFiles = updates.processedFiles ?? row.processed_files;
    const copiedSize = updates.copiedSize ?? row.copied_size;
    const status = updates.status ?? row.status;
    const completedAt = status === 'completed' || status === 'failed' ? new Date().toISOString() : row.completed_at;
    db.prepare(`
        UPDATE sync_tasks SET processed_files = ?, copied_size = ?, status = ?, completed_at = ?
        WHERE id = ?
    `).run(processedFiles, copiedSize, status, completedAt ?? null, taskId);
};

export const getActiveSyncTaskBySourceId = (sourceId: number) => {
    return db.prepare("SELECT * FROM sync_tasks WHERE source_id = ? AND status IN ('pending', 'running', 'paused') ORDER BY id DESC LIMIT 1").get(sourceId) as SyncTaskRow | undefined;
};

export const getSyncTaskById = (id: number) => {
    return db.prepare('SELECT * FROM sync_tasks WHERE id = ?').get(id) as SyncTaskRow | undefined;
};

// Types for sync tables
export interface SyncSourceRow {
    id: number;
    name: string;
    path: string;
    enabled: number;
    last_sync_at: string | null;
    auto_sync: number;
    sync_interval: number;
    from_date: string | null;
    to_date: string | null;
    created_at: string;
}

export interface SyncRecordRow {
    id: number;
    source_id: number;
    source_path: string;
    file_hash: string;
    file_size: number | null;
    file_mtime: string | null;
    target_path: string | null;
    status: string;
    copied_at: string | null;
    error_message: string | null;
}

export interface SyncTaskRow {
    id: number;
    source_id: number;
    status: string;
    total_files: number;
    processed_files: number;
    total_size: number;
    copied_size: number;
    started_at: string | null;
    completed_at: string | null;
}

/** Reset sync task status for stale tasks left running from a previous crash. */
export const cleanupStaleSyncTasks = () => {
    const result = db.prepare(`
        UPDATE sync_tasks SET status = 'failed', completed_at = datetime('now')
        WHERE status IN ('pending', 'running', 'paused')
          AND started_at < datetime('now', '-1 hour')
    `).run();
    if (result.changes > 0) {
        console.log(`[Sync Cleanup] Marked ${result.changes} stale sync task(s) as failed from previous run.`);
    }
    return result.changes;
};
