import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { organizeUploads, getAllImages } from './organizer.ts';
import { parseImageFile } from './metadata.ts';
import type { GalleryImage } from '../types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

// Middleware
app.use(cors());
app.use(express.json());

// Static files
// Mount uploads at /uploads
// Note: We need to handle the fact that files are inside date folders now.
// Express static serves directory contents. If we request /uploads/2023-10-27/img.png, it works if we mount UPLOADS_DIR at /uploads.
app.use('/uploads', express.static(UPLOADS_DIR));

// API Routes
app.get('/api/images', async (req, res) => {
    try {
        // 1. Organize new files first (optional, or run periodically)
        // Doing it on request might be slow if many files, but ensures consistency. 
        // Let's do it on startup mostly, but maybe check root here? 
        // For performance, let's skip re-organizing on every read, only on startup or dedicated trigger.
        
        // 2. Scan all images
        const imagePaths = await getAllImages(UPLOADS_DIR);
        
        // 3. Process metadata and sort
        const galleryImages: GalleryImage[] = [];
        
        // Parallel processing
        await Promise.all(imagePaths.map(async (filePath) => {
            try {
                const stats = await fs.stat(filePath);
                const metadata = await parseImageFile(filePath);
                
                // Construct URL
                // filePath is absolute. We need relative to UPLOADS_DIR.
                const relativePath = path.relative(UPLOADS_DIR, filePath);
                // Replace backslashes with forward slashes for URL
                const urlPath = relativePath.split(path.sep).join('/');
                const url = `/uploads/${urlPath}`;
                
                galleryImages.push({
                    id: path.basename(filePath), // or hash
                    url: url,
                    fileName: path.basename(filePath),
                    metadata: metadata,
                    isFavorite: false, // Persisting favorites would require a database. For now default to false.
                    dateAdded: stats.mtime.toISOString(),
                    story: undefined // Story persistence also needs DB.
                });
            } catch (err) {
                console.error(`Error processing ${filePath}:`, err);
            }
        }));
        
        // Sort by date (newest first)
        galleryImages.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
        
        res.json(galleryImages);
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: "Failed to fetch images" });
    }
});

// Trigger organization on startup
organizeUploads(UPLOADS_DIR).then(() => {
    console.log("Initial file organization complete.");
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
