import fs from 'fs/promises';
import path from 'path';

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
                // If target exists, maybe rename or skip? Overwriting for now or assuming unique names.
                // To be safe, check if exists.
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
