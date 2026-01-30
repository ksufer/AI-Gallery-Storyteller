import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs/promises';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import { organizeUploads, syncImagesWithDb, getSafeFileName } from './organizer.ts';
import { getImages, getTagsWithCount, upsertImage, updateImageStory } from './db.ts';
import { parseImageFile } from './metadata.ts';
import type { GalleryImage } from '../types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
const CONFIG_DIR = path.resolve(__dirname, '../config');

// Default to development if NODE_ENV is not set
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.json());

// Static files
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/config', express.static(CONFIG_DIR));

// Configure multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.png', '.jpg', '.jpeg', '.webp'];
        if (allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            // silently ignore non-image files instead of throwing error
            cb(null, false);
        }
    }
});

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
                story: row.story || undefined
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

// Update story endpoint
app.patch('/api/images/:id/story', async (req, res) => {
    try {
        const { id } = req.params;
        const { story } = req.body;
        
        if (!story) {
            return res.status(400).json({ error: "Story content is required" });
        }
        
        updateImageStory(id, story);
        res.json({ success: true, message: "Story updated" });
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: "Failed to update story" });
    }
});

// File upload endpoint
app.post('/api/upload', upload.array('files', 1000), async (req, res) => {
    try {
        if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const files = Array.isArray(req.files) ? req.files : [req.files];
        const uploadedFiles: Array<{ fileName: string; success: boolean; error?: string }> = [];

        // Extract lastModified timestamps from request body
        // Handle both string (single file) and array (multiple files) cases
        let lastModifiedArray: string[] = [];
        if (req.body.lastModified) {
            if (Array.isArray(req.body.lastModified)) {
                lastModifiedArray = req.body.lastModified;
            } else {
                lastModifiedArray = [req.body.lastModified];
            }
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                // Determine date from lastModified timestamp if available, otherwise use current date
                let date: Date;
                if (i < lastModifiedArray.length && lastModifiedArray[i]) {
                    const timestamp = parseInt(lastModifiedArray[i], 10);
                    if (!isNaN(timestamp)) {
                        date = new Date(timestamp);
                    } else {
                        date = new Date();
                    }
                } else {
                    date = new Date();
                }
                
                const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
                const targetDir = path.join(UPLOADS_DIR, dateStr);

                // Create directory if not exists
                try {
                    await fs.access(targetDir);
                } catch {
                    await fs.mkdir(targetDir, { recursive: true });
                }

                // Get safe filename to avoid collisions
                const safeFileName = await getSafeFileName(targetDir, file.originalname);
                const targetPath = path.join(targetDir, safeFileName);

                // Save file to disk
                await fs.writeFile(targetPath, file.buffer);

                // Parse metadata
                const metadata = await parseImageFile(targetPath);
                
                // Use the date from lastModified (or current date) for database
                const dateAdded = date.toISOString();
                const uniqueId = path.basename(targetPath) + '_' + date.getTime();

                // Save to database with the date from lastModified timestamp
                upsertImage(uniqueId, targetPath, dateAdded, metadata);

                uploadedFiles.push({
                    fileName: safeFileName,
                    success: true
                });

                console.log(`Uploaded and processed: ${safeFileName}`);
            } catch (error: any) {
                console.error(`Error processing file ${file.originalname}:`, error);
                uploadedFiles.push({
                    fileName: file.originalname,
                    success: false,
                    error: error.message || 'Unknown error'
                });
            }
        }

        res.json({
            message: `Processed ${uploadedFiles.length} file(s)`,
            files: uploadedFiles
        });
    } catch (error: any) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: error.message || "Failed to upload files" });
    }
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Server Error:", err);
    if (err instanceof multer.MulterError) {
        // Multer-specific errors
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    res.status(500).json({ error: err.message || "Internal Server Error" });
});

// Create HTTP server explicitly to ensure it keeps process alive
const server = http.createServer(app);

// Trigger organization and sync on startup
const init = async () => {
    // Ensure uploads root exists
    try {
        await fs.access(UPLOADS_DIR);
    } catch {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
    }

    await organizeUploads(UPLOADS_DIR);
    await syncImagesWithDb(UPLOADS_DIR);
    console.log("Initialization complete.");

    // Periodic scan every 60 seconds
    setInterval(async () => {
        try {
            // console.log("Running periodic scan...");
            await organizeUploads(UPLOADS_DIR);
            await syncImagesWithDb(UPLOADS_DIR);
        } catch (e) {
            console.error("Periodic scan error:", e);
        }
    }, 60 * 1000);
};

// Setup Vite or static file serving
const setupServer = async () => {
    if (isProduction) {
        // Production: serve static files from dist
        const distPath = path.resolve(__dirname, '../dist');
        app.use(express.static(distPath));
        
        // Serve index.html for non-api routes (SPA fallback)
        app.get(/(.*)/, (req, res, next) => {
            if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
                return next();
            }
            res.sendFile(path.join(distPath, 'index.html'));
        });
    } else {
        // Development: use Vite middleware
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'custom'
        });
        
        // Use Vite's connect instance as middleware
        app.use(vite.middlewares);
        
        // Serve index.html for non-api routes (SPA fallback)
        app.get(/(.*)/, async (req, res, next) => {
            if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
                return next();
            }
            try {
                const url = req.originalUrl;
                const template = await fs.readFile(path.resolve(__dirname, '../index.html'), 'utf-8');
                const html = await vite.transformIndexHtml(url, template);
                res.setHeader('Content-Type', 'text/html');
                res.send(html);
            } catch (e) {
                vite.ssrFixStacktrace(e as Error);
                next(e);
            }
        });
    }
};

// Start server
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
    await setupServer();
    // Start init after server is listening
    init().catch(err => console.error("Init failed:", err));
});

// Keep-alive hack (optional, but helps if something weird is closing the loop)
setInterval(() => {}, 1000 * 60 * 60);
