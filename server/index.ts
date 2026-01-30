import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { organizeUploads, syncImagesWithDb } from './organizer.ts';
import { getImages, getTagsWithCount } from './db.ts';
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
app.use('/uploads', express.static(UPLOADS_DIR));

// API Routes
app.get('/api/images', async (req, res) => {
    try {
        const rows = getImages() as any[];
        
        const galleryImages: GalleryImage[] = rows.map(row => {
            const relativePath = path.relative(UPLOADS_DIR, row.file_path);
            const urlPath = relativePath.split(path.sep).join('/');
            
            return {
                id: row.id,
                url: `/uploads/${urlPath}`,
                fileName: path.basename(row.file_path),
                metadata: JSON.parse(row.meta_json),
                isFavorite: false, // Not stored in DB yet
                dateAdded: row.date_added,
                story: undefined
            };
        });
        
        res.json(galleryImages);
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: "Failed to fetch images" });
    }
});

app.get('/api/tags', (req, res) => {
    try {
        const search = req.query.q as string;
        const tags = getTagsWithCount(search);
        res.json(tags);
    } catch (error) {
         console.error("API Error:", error);
         res.status(500).json({ error: "Failed to fetch tags" });
    }
});

// Trigger organization and sync on startup
const init = async () => {
    await organizeUploads(UPLOADS_DIR);
    await syncImagesWithDb(UPLOADS_DIR);
    console.log("Initialization complete.");
};

init();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
