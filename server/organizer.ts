import fs from 'fs/promises';
import path from 'path';
import { getImages, upsertImage, deleteImage, getImageByPath } from './db.ts';
import { parseImageFile } from './metadata.ts';

export const organizeUploads = async (uploadsDir: string) => {
    try {
        const files = await fs.readdir(uploadsDir, { withFileTypes: true });
        
        for (const file of files) {
            // Only organize files, skip directories (which are likely already date folders)
            if (file.isFile() && isImageFile(file.name)) {
                const filePath = path.join(uploadsDir, file.name);
                const stats = await fs.stat(filePath);
                
                const date = new Date(stats.mtime);
                const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
                
                const targetDir = path.join(uploadsDir, dateStr);
                
                // Create directory if not exists
                try {
                    await fs.access(targetDir);
                } catch {
                    await fs.mkdir(targetDir, { recursive: true });
                }
                
                const targetPath = path.join(targetDir, file.name);
                
                // Move file
                // If target exists, skip or overwrite?
                try {
                    await fs.access(targetPath);
                    console.log(`File ${file.name} already exists in ${dateStr}, skipping.`);
                } catch {
                    await fs.rename(filePath, targetPath);
                    console.log(`Moved ${file.name} to ${dateStr}/`);
                }
            }
        }
    } catch (error) {
        console.error("Error organizing uploads:", error);
    }
};

const isImageFile = (filename: string): boolean => {
    const ext = path.extname(filename).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
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

export const syncImagesWithDb = async (uploadsDir: string) => {
    console.log("Syncing images with database...");
    
    // 1. Get all files on disk
    const fsPaths = await getAllImages(uploadsDir);
    const fsPathSet = new Set(fsPaths);
    
    // 2. Get all images in DB
    const dbImages = getImages() as any[];
    const dbPathMap = new Map<string, string>(); // path -> id
    dbImages.forEach(img => dbPathMap.set(img.file_path, img.id));
    
    // 3. Identify removed files
    for (const [dbPath, dbId] of dbPathMap) {
        if (!fsPathSet.has(dbPath)) {
            console.log(`Removing missing file from DB: ${dbPath}`);
            deleteImage(dbId);
        }
    }
    
    // 4. Identify added files
    for (const fsPath of fsPaths) {
        if (!dbPathMap.has(fsPath)) {
            console.log(`Adding new file to DB: ${fsPath}`);
            try {
                const stats = await fs.stat(fsPath);
                const metadata = await parseImageFile(fsPath);
                const id = path.basename(fsPath); // Using filename as ID for simplicity, or uuid
                // Note: ID collision possible if same filename in different folders?
                // Plan said "id, path, date, meta_json".
                // Ideally use content hash or uuid.
                // But for now, let's use relative path or random UUID?
                // Let's use crypto.randomUUID if available or just timestamp + random
                const uniqueId =  path.basename(fsPath) + '_' + stats.mtime.getTime(); 
                
                upsertImage(uniqueId, fsPath, stats.mtime.toISOString(), metadata);
            } catch (err) {
                console.error(`Failed to parse ${fsPath}:`, err);
            }
        }
    }
    
    console.log("Sync complete.");
};
