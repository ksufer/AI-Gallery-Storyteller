import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Tags table
    db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    `);

    // Junction table
    db.exec(`
        CREATE TABLE IF NOT EXISTS image_tags (
            image_id TEXT,
            tag_id INTEGER,
            PRIMARY KEY (image_id, tag_id),
            FOREIGN KEY(image_id) REFERENCES images(id) ON DELETE CASCADE,
            FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
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
    INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)
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
                if (t.length > 0 && t.length < 50) {
                    tagsToInsert.add(t);
                }
            });
        });
        
        for (const tag of tagsToInsert) {
            insertTag.run(tag);
            const tagRow = getTagId.get(tag) as { id: number };
            if (tagRow) {
                insertImageTag.run(id, tagRow.id);
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

export const getImages = () => {
    return db.prepare('SELECT * FROM images ORDER BY date_added DESC').all();
};

export const getImageTags = (imageId: string) => {
    return db.prepare(`
        SELECT t.name FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        WHERE it.image_id = ?
    `).all().map((row: any) => row.name);
};

export const getTagsWithCount = (search?: string) => {
    let query = `
        SELECT t.name, COUNT(it.image_id) as count
        FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
    `;
    
    const params = [];
    if (search) {
        query += ` WHERE t.name LIKE ?`;
        params.push(`%${search}%`);
    }
    
    query += ` GROUP BY t.id ORDER BY count DESC`;
    
    return db.prepare(query).all(...params);
};

export const getImageByPath = (filePath: string) => {
    return db.prepare('SELECT * FROM images WHERE file_path = ?').get(filePath);
};
