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
import { getImages, getImagesByTag, getFavoriteImages, getTagsWithCount, upsertImage, updateImageStory, updateImageFavorite, deleteImage, getImageById, addTagToImage, removeTagFromImage, getImageTags, loadBlockedTags } from './db.ts';
import { parseImageFile } from './metadata.ts';
import type { GalleryImage, PaginatedResponse } from '../types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Load server configuration from environment variables
const PORT = parseInt(process.env.PORT || '3000', 10);
const ENABLE_REMOTE_ACCESS = process.env.ENABLE_REMOTE_ACCESS === 'true';
const HOST = ENABLE_REMOTE_ACCESS 
    ? '0.0.0.0' 
    : (process.env.HOST || '127.0.0.1');

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
        // Parse pagination parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;
        
        // Get all rows based on filters
        let allRows: any[];
        
        // Filter by favorite first (most efficient)
        if (req.query.favorite === 'true') {
            allRows = getFavoriteImages() as any[];
        }
        // Filter by tag (from database)
        else if (req.query.tag) {
            const tagName = req.query.tag as string;
            allRows = getImagesByTag(tagName) as any[];
        } 
        // Get all images
        else {
            allRows = getImages() as any[];
        }
        
        // Apply additional filtering
        let filteredRows = allRows;
        
        // Filter by folder
        if (req.query.folder) {
            const folder = req.query.folder as string;
            filteredRows = filteredRows.filter(row => 
                row.file_path.includes(path.sep + folder + path.sep) || 
                row.file_path.includes('/' + folder + '/')
            );
        }
        
        // Get total count
        const total = filteredRows.length;
        
        // Apply pagination
        const paginatedRows = filteredRows.slice(offset, offset + limit);
        
        const galleryImages: GalleryImage[] = paginatedRows.map(row => {
            const relativePath = path.relative(UPLOADS_DIR, row.file_path);
            const urlPath = relativePath.split(path.sep).join('/');
            
            return {
                id: row.id,
                url: `/uploads/${urlPath}`,
                fileName: path.basename(row.file_path),
                metadata: JSON.parse(row.meta_json),
                isFavorite: row.is_favorite === 1,
                dateAdded: row.date_added,
                story: row.story || undefined
            };
        });
        
        // Check if legacy mode (no pagination params)
        if (!req.query.page && !req.query.limit) {
            // Return legacy format for backward compatibility
            res.json(galleryImages);
        } else {
            // Return paginated response
            const response: PaginatedResponse<GalleryImage> = {
                data: galleryImages,
                total,
                page,
                limit,
                hasMore: offset + limit < total
            };
            res.json(response);
        }
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: "Failed to fetch images" });
    }
});

app.get('/api/tags', (req, res) => {
    try {
        const search = req.query.q as string;
        const source = req.query.source as 'auto' | 'user' | undefined;
        const tags = getTagsWithCount(search, source);
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

// Update favorite endpoint
app.patch('/api/images/:id/favorite', async (req, res) => {
    try {
        const { id } = req.params;
        const { isFavorite } = req.body;
        
        if (typeof isFavorite !== 'boolean') {
            return res.status(400).json({ error: "isFavorite must be a boolean" });
        }
        
        updateImageFavorite(id, isFavorite);
        res.json({ success: true, message: "Favorite status updated", isFavorite });
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: "Failed to update favorite status" });
    }
});

// Delete image endpoint
app.delete('/api/images/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get image info from database
        const image = getImageById(id) as any;
        if (!image) {
            return res.status(404).json({ success: false, error: "Image not found" });
        }
        
        // Delete physical file
        try {
            await fs.unlink(image.file_path);
            console.log(`Deleted file: ${image.file_path}`);
        } catch (fileError: any) {
            console.error(`Failed to delete file ${image.file_path}:`, fileError);
            // Continue to delete DB record even if file doesn't exist
        }
        
        // Delete from database
        deleteImage(id);
        
        res.json({ success: true, message: "Image deleted successfully" });
    } catch (error: any) {
        console.error("Delete API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to delete image" });
    }
});

// Get image tags endpoint
app.get('/api/images/:id/tags', async (req, res) => {
    try {
        const { id } = req.params;
        const tags = getImageTags(id);
        res.json({ success: true, tags });
    } catch (error: any) {
        console.error("Get Tags API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to get tags" });
    }
});

// Add tag to image endpoint
app.post('/api/images/:id/tags', async (req, res) => {
    try {
        const { id } = req.params;
        const { tagName } = req.body;
        
        if (!tagName || typeof tagName !== 'string' || tagName.trim().length === 0) {
            return res.status(400).json({ success: false, error: "Tag name is required" });
        }
        
        const trimmedTag = tagName.trim();
        if (trimmedTag.length > 50) {
            return res.status(400).json({ success: false, error: "Tag name too long (max 50 characters)" });
        }
        
        // Check if image exists
        const image = getImageById(id);
        if (!image) {
            return res.status(404).json({ success: false, error: "Image not found" });
        }
        
        addTagToImage(id, trimmedTag);
        const tags = getImageTags(id);
        
        res.json({ success: true, tags });
    } catch (error: any) {
        console.error("Add Tag API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to add tag" });
    }
});

// Remove tag from image endpoint
app.delete('/api/images/:id/tags/:tagName', async (req, res) => {
    try {
        const { id, tagName } = req.params;
        
        removeTagFromImage(id, decodeURIComponent(tagName));
        const tags = getImageTags(id);
        
        res.json({ success: true, tags });
    } catch (error: any) {
        console.error("Remove Tag API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to remove tag" });
    }
});

// Get forbidden words settings
app.get('/api/settings/forbidden-words', async (req, res) => {
    try {
        const configPath = path.join(CONFIG_DIR, 'forbidden-words.json');
        
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            const words = JSON.parse(content);
            res.json({ success: true, data: words });
        } catch (error: any) {
            // If file doesn't exist, return empty object
            if (error.code === 'ENOENT') {
                res.json({ success: true, data: {} });
            } else {
                throw error;
            }
        }
    } catch (error: any) {
        console.error("Get Settings API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to read settings" });
    }
});

// Update forbidden words settings
app.put('/api/settings/forbidden-words', async (req, res) => {
    try {
        const words = req.body;
        
        // Validate that it's an object
        if (!words || typeof words !== 'object' || Array.isArray(words)) {
            return res.status(400).json({ success: false, error: "Invalid format: must be an object" });
        }
        
        // Validate all keys and values are strings
        for (const [key, value] of Object.entries(words)) {
            if (typeof key !== 'string' || typeof value !== 'string') {
                return res.status(400).json({ success: false, error: "All keys and values must be strings" });
            }
        }
        
        const configPath = path.join(CONFIG_DIR, 'forbidden-words.json');
        
        // Ensure config directory exists
        try {
            await fs.access(CONFIG_DIR);
        } catch {
            await fs.mkdir(CONFIG_DIR, { recursive: true });
        }
        
        // Write to file with pretty formatting
        await fs.writeFile(configPath, JSON.stringify(words, null, 2), 'utf-8');
        
        res.json({ success: true, message: "Settings updated successfully" });
    } catch (error: any) {
        console.error("Update Settings API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to update settings" });
    }
});

// Get blocked tags settings
app.get('/api/settings/blocked-tags', async (req, res) => {
    try {
        const configPath = path.join(CONFIG_DIR, 'blocked-tags.json');
        
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            const tags = JSON.parse(content);
            res.json({ success: true, data: tags });
        } catch (error: any) {
            // If file doesn't exist, return empty array
            if (error.code === 'ENOENT') {
                res.json({ success: true, data: [] });
            } else {
                throw error;
            }
        }
    } catch (error: any) {
        console.error("Get Blocked Tags API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to read blocked tags" });
    }
});

// Update blocked tags settings
app.put('/api/settings/blocked-tags', async (req, res) => {
    try {
        const tags = req.body;
        
        // Validate that it's an array
        if (!Array.isArray(tags)) {
            return res.status(400).json({ success: false, error: "Invalid format: must be an array" });
        }
        
        // Validate all items are strings
        for (const tag of tags) {
            if (typeof tag !== 'string') {
                return res.status(400).json({ success: false, error: "All items must be strings" });
            }
        }
        
        const configPath = path.join(CONFIG_DIR, 'blocked-tags.json');
        
        // Ensure config directory exists
        try {
            await fs.access(CONFIG_DIR);
        } catch {
            await fs.mkdir(CONFIG_DIR, { recursive: true });
        }
        
        // Write to file with pretty formatting
        await fs.writeFile(configPath, JSON.stringify(tags, null, 2), 'utf-8');
        
        // Reload blocked tags in memory
        const reloaded = loadBlockedTags();
        
        res.json({ 
            success: true, 
            message: "Blocked tags updated successfully",
            reloaded 
        });
    } catch (error: any) {
        console.error("Update Blocked Tags API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to update blocked tags" });
    }
});

// Reload blocked tags configuration
app.post('/api/settings/blocked-tags/reload', (req, res) => {
    try {
        const success = loadBlockedTags();
        res.json({ 
            success, 
            message: success ? "Blocked tags reloaded successfully" : "Failed to reload blocked tags" 
        });
    } catch (error: any) {
        console.error("Reload Blocked Tags API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to reload blocked tags" });
    }
});

// Get folders list
app.get('/api/folders', async (req, res) => {
    try {
        const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
        
        // Filter for date folders (YYYY-MM-DD format)
        const dateFolderRegex = /^\d{4}-\d{2}-\d{2}$/;
        const folders = entries
            .filter(entry => entry.isDirectory() && dateFolderRegex.test(entry.name))
            .map(entry => entry.name)
            .sort()
            .reverse(); // Most recent first
        
        // Count images in each folder
        const counts: { [key: string]: number } = {};
        const allImages = getImages() as any[];
        
        for (const folder of folders) {
            counts[folder] = allImages.filter(img => 
                img.file_path.includes(path.sep + folder + path.sep) || 
                img.file_path.includes('/' + folder + '/')
            ).length;
        }
        
        res.json({ success: true, folders, counts });
    } catch (error: any) {
        console.error("Get Folders API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to get folders" });
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
server.listen(PORT, HOST, async () => {
    const accessInfo = ENABLE_REMOTE_ACCESS 
        ? `\n  - 远程访问: http://<your-local-ip>:${PORT}`
        : '';
    
    console.log(`
┌─────────────────────────────────────────────────────────┐
│  🎨 AI Gallery Storyteller                              │
├─────────────────────────────────────────────────────────┤
│  Server running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode                      │
│                                                         │
│  Access URLs:                                           │
│  - 本地访问: http://localhost:${PORT}${accessInfo}
│                                                         │
│  Configuration:                                         │
│  - Port: ${PORT}                                           │
│  - Host: ${HOST}                                   │
│  - Remote Access: ${ENABLE_REMOTE_ACCESS ? 'ENABLED ✅' : 'DISABLED ❌'}                      │
└─────────────────────────────────────────────────────────┘
    `.trim());
    
    await setupServer();
    // Start init after server is listening
    init().catch(err => console.error("Init failed:", err));
});

// Keep-alive hack (optional, but helps if something weird is closing the loop)
setInterval(() => {}, 1000 * 60 * 60);
