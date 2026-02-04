import dotenv from 'dotenv';
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
import { getImages, getImagesByTag, getFavoriteImages, getTagsWithCount, upsertImage, updateImageStory, updateImageFavorite, deleteImage, getImageById, addTagToImage, removeTagFromImage, getImageTags, loadBlockedTags, markSyncRecordDeletedByFilePath, createSyncSource, getSyncSources, getSyncSourceById, updateSyncSource, deleteSyncSource, resetDeletedRecordsBySourceId, getActiveSyncTaskBySourceId } from './db.ts';
import { parseImageFile } from './metadata.ts';
import { validateSourcePath, runSync, scanSourceDirectory, getSyncProgress, setSyncRunState, getSyncRunState } from './syncService.ts';
import { buildTxt2ImgPayload, generateTxt2Img } from './sdWebuiClient.ts';
import type { GalleryImage, PaginatedResponse } from '../types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

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

// Generate story endpoint for single image (Streamed)
app.post('/api/images/:id/generate-story', async (req, res) => {
    try {
        const { id } = req.params;
        const { userKeywords } = req.body;
        
        // Get image from database
        const image = getImageById(id) as any;
        if (!image) {
            return res.status(404).json({ error: "Image not found" });
        }
        
        const metadata = JSON.parse(image.meta_json);
        const prompts = metadata.prompts || [];
        
        // Read image file and convert to base64
        const imageBuffer = await fs.readFile(image.file_path);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = image.file_path.endsWith('.png') ? 'image/png' : 
                       image.file_path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        
        // 根据环境变量选择 AI Provider
        const aiProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
        
        console.log(`[Story] Start generating for image ${id} using ${aiProvider} (Stream)...`);
        
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        let generateStoryStream: any;
        
        if (aiProvider === 'openai') {
            const module = await import('../services/openaiService.js');
            generateStoryStream = module.generateStoryStream;
        } else {
            const module = await import('../services/geminiService.js');
            generateStoryStream = module.generateStoryStream;
        }

        const stream = generateStoryStream(prompts, {
            data: base64Image,
            mimeType
        }, userKeywords);

        let fullStory = '';

        try {
            for await (const chunk of stream) {
                fullStory += chunk;
                // Send chunk to client
                res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            }
            
            // Update in database
            updateImageStory(id, fullStory);
            
            // Send done signal
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
            console.log(`[Story] Stream completed for image ${id}. Length: ${fullStory.length}`);
            
        } catch (streamError: any) {
            console.error("Stream generation error:", streamError);
            res.write(`data: ${JSON.stringify({ error: streamError.message || "生成中断" })}\n\n`);
            res.end();
        }

    } catch (error: any) {
        console.error("Generate Story API Error:", error);
        // If headers haven't been sent yet, send JSON error
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || "Failed to generate story" });
        } else {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        }
    }
});

// Chat as character (画中人对话)
app.post('/api/images/:id/chat', async (req, res) => {
    try {
        const { id } = req.params;
        const { message, history } = req.body as { message?: string; history?: Array<{ role: 'user' | 'model'; text: string }> };

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: "message is required and must be non-empty" });
        }

        const maxHistory = 20;
        const safeHistory = Array.isArray(history)
            ? history
                .filter((h: any) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
                .slice(-maxHistory)
                .map((h: any) => ({ role: h.role as 'user' | 'model', text: String(h.text).trim() }))
            : [];

        const image = getImageById(id) as any;
        if (!image) {
            return res.status(404).json({ error: "Image not found" });
        }

        const imageBuffer = await fs.readFile(image.file_path);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = image.file_path.endsWith('.png') ? 'image/png' :
            image.file_path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

        const aiProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
        const story = image.story || undefined;
        const imagePayload = { data: base64Image, mimeType };
        const chatPayload = { image: imagePayload, story, userMessage: message.trim(), history: safeHistory };

        let reply: string;
        if (aiProvider === 'openai') {
            const { chatAsCharacter } = await import('../services/openaiService.js');
            reply = await chatAsCharacter(chatPayload);
        } else {
            const { chatAsCharacter } = await import('../services/geminiService.js');
            reply = await chatAsCharacter(chatPayload);
        }

        res.json({ reply });
    } catch (error: any) {
        console.error("Chat API Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || "Chat failed" });
        }
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
        markSyncRecordDeletedByFilePath(image.file_path);
        
        res.json({ success: true, message: "Image deleted successfully" });
    } catch (error: any) {
        console.error("Delete API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to delete image" });
    }
});

// Make same style (做同款) - call SD WebUI txt2img with image metadata
app.post('/api/images/:id/make-same-style', async (req, res) => {
    try {
        const baseUrl = process.env.SD_WEBUI_URL?.trim();
        if (!baseUrl) {
            return res.status(503).json({
                error: 'SD WebUI 未配置。请在 .env.local 中设置 SD_WEBUI_URL（例如 http://127.0.0.1:7860），并确保 WebUI 已使用 --api 启动。'
            });
        }

        const { id } = req.params;
        const row = getImageById(id) as any;
        if (!row) {
            return res.status(404).json({ error: 'Image not found' });
        }

        let metadata: any;
        try {
            metadata = typeof row.meta_json === 'string' ? JSON.parse(row.meta_json) : row.meta_json;
        } catch {
            return res.status(400).json({ error: '无效的图片元数据' });
        }
        if (metadata?.type !== 'SD WebUI') {
            return res.status(400).json({ error: '仅支持 SD WebUI 来源的图片' });
        }

        const payload = buildTxt2ImgPayload(metadata);
        const apiRes = await generateTxt2Img(baseUrl, payload);

        const b64 = apiRes.images?.[0];
        if (!b64) {
            return res.status(502).json({ error: 'SD WebUI 未返回图片' });
        }

        const buffer = Buffer.from(b64, 'base64');
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const targetDir = path.join(UPLOADS_DIR, dateStr);
        try {
            await fs.access(targetDir);
        } catch {
            await fs.mkdir(targetDir, { recursive: true });
        }
        const safeName = await getSafeFileName(targetDir, 'same-style.png');
        const targetPath = path.join(targetDir, safeName);
        await fs.writeFile(targetPath, buffer);

        // Optionally update seed in metadata from API info
        try {
            const info = typeof apiRes.info === 'string' ? JSON.parse(apiRes.info) : apiRes.info;
            if (info?.seed != null && metadata.sampler) {
                metadata = { ...metadata, sampler: { ...metadata.sampler, seed: info.seed } };
            }
        } catch {
            // keep metadata as is
        }

        const dateAdded = date.toISOString();
        const uniqueId = path.basename(targetPath) + '_' + date.getTime();
        upsertImage(uniqueId, targetPath, dateAdded, metadata);

        const relativePath = path.relative(UPLOADS_DIR, targetPath);
        const urlPath = relativePath.split(path.sep).join('/');
        const galleryImage: GalleryImage = {
            id: uniqueId,
            url: `/uploads/${urlPath}`,
            fileName: path.basename(targetPath),
            metadata,
            isFavorite: false,
            dateAdded,
            story: undefined
        };

        res.status(201).json({ success: true, image: galleryImage });
    } catch (error: any) {
        console.error('Make same style API Error:', error);
        const message = error?.message || '做同款失败，请检查 SD WebUI 是否已启动且已开启 --api';
        res.status(502).json({ error: message });
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

// ============================================
// Batch Operations API
// ============================================

// Batch delete images
app.post('/api/batch/delete', async (req, res) => {
    try {
        const { imageIds } = req.body;
        
        if (!Array.isArray(imageIds) || imageIds.length === 0) {
            return res.status(400).json({ success: false, error: "imageIds must be a non-empty array" });
        }
        
        const results = await Promise.allSettled(
            imageIds.map(async (id) => {
                const image = getImageById(id) as any;
                if (!image) {
                    throw new Error(`Image not found: ${id}`);
                }
                
                // Delete physical file
                try {
                    await fs.unlink(image.file_path);
                } catch (fileError: any) {
                    console.warn(`Failed to delete file ${image.file_path}:`, fileError);
                }
                
                // Delete from database
                deleteImage(id);
                markSyncRecordDeletedByFilePath(image.file_path);
                return id;
            })
        );
        
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        const errors = results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map((r, index) => ({ imageId: imageIds[index], error: r.reason.message }));
        
        res.json({
            success: succeeded > 0,
            total: imageIds.length,
            succeeded,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error: any) {
        console.error("Batch Delete API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to batch delete images" });
    }
});

// Batch update favorite status
app.post('/api/batch/favorite', async (req, res) => {
    try {
        const { imageIds, isFavorite } = req.body;
        
        if (!Array.isArray(imageIds) || imageIds.length === 0) {
            return res.status(400).json({ success: false, error: "imageIds must be a non-empty array" });
        }
        
        if (typeof isFavorite !== 'boolean') {
            return res.status(400).json({ success: false, error: "isFavorite must be a boolean" });
        }
        
        const results = await Promise.allSettled(
            imageIds.map(async (id) => {
                const image = getImageById(id);
                if (!image) {
                    throw new Error(`Image not found: ${id}`);
                }
                updateImageFavorite(id, isFavorite);
                return id;
            })
        );
        
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        const errors = results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map((r, index) => ({ imageId: imageIds[index], error: r.reason.message }));
        
        res.json({
            success: succeeded > 0,
            total: imageIds.length,
            succeeded,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error: any) {
        console.error("Batch Favorite API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to batch update favorite status" });
    }
});

// Batch add tag to images
app.post('/api/batch/tags', async (req, res) => {
    try {
        const { imageIds, tagName } = req.body;
        
        if (!Array.isArray(imageIds) || imageIds.length === 0) {
            return res.status(400).json({ success: false, error: "imageIds must be a non-empty array" });
        }
        
        if (!tagName || typeof tagName !== 'string' || tagName.trim().length === 0) {
            return res.status(400).json({ success: false, error: "Tag name is required" });
        }
        
        const trimmedTag = tagName.trim();
        if (trimmedTag.length > 50) {
            return res.status(400).json({ success: false, error: "Tag name too long (max 50 characters)" });
        }
        
        const results = await Promise.allSettled(
            imageIds.map(async (id) => {
                const image = getImageById(id);
                if (!image) {
                    throw new Error(`Image not found: ${id}`);
                }
                addTagToImage(id, trimmedTag);
                return id;
            })
        );
        
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        const errors = results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map((r, index) => ({ imageId: imageIds[index], error: r.reason.message }));
        
        res.json({
            success: succeeded > 0,
            total: imageIds.length,
            succeeded,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error: any) {
        console.error("Batch Tags API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to batch add tags" });
    }
});

// Batch generate stories
app.post('/api/batch/stories', async (req, res) => {
    try {
        const { imageIds } = req.body;
        
        if (!Array.isArray(imageIds) || imageIds.length === 0) {
            return res.status(400).json({ success: false, error: "imageIds must be a non-empty array" });
        }
        
        // 根据环境变量选择 AI Provider
        const aiProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
        let generateStoryFromPrompts: any;
        
        if (aiProvider === 'openai') {
            const module = await import('../services/openaiService.js');
            generateStoryFromPrompts = module.generateStoryFromPrompts;
        } else {
            const module = await import('../services/geminiService.js');
            generateStoryFromPrompts = module.generateStoryFromPrompts;
        }
        
        let succeeded = 0;
        let failed = 0;
        const errors: Array<{ imageId: string; error: string }> = [];
        
        // Process sequentially to avoid API rate limits
        for (const id of imageIds) {
            try {
                const image = getImageById(id) as any;
                if (!image) {
                    throw new Error(`Image not found: ${id}`);
                }
                
                const metadata = JSON.parse(image.meta_json);
                const prompts = metadata.prompts || [];
                
                // Read image file and convert to base64
                const imageBuffer = await fs.readFile(image.file_path);
                const base64Image = imageBuffer.toString('base64');
                const mimeType = image.file_path.endsWith('.png') ? 'image/png' : 
                               image.file_path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
                
                const story = await generateStoryFromPrompts(prompts, {
                    data: base64Image,
                    mimeType
                });
                
                updateImageStory(id, story);
                succeeded++;
            } catch (error: any) {
                console.error(`Failed to generate story for ${id}:`, error);
                errors.push({ imageId: id, error: error.message || 'Unknown error' });
                failed++;
            }
        }
        
        res.json({
            success: succeeded > 0,
            total: imageIds.length,
            succeeded,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error: any) {
        console.error("Batch Stories API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to batch generate stories" });
    }
});

// ============================================
// Sync API
// ============================================

// List sync sources
app.get('/api/sync/sources', (req, res) => {
    try {
        const sources = getSyncSources();
        res.json({ success: true, data: sources });
    } catch (error: any) {
        console.error("Sync sources list error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to list sync sources" });
    }
});

// Add sync source
app.post('/api/sync/sources', async (req, res) => {
    try {
        const { name, path: sourcePath, fromDate, toDate, autoSync, syncInterval } = req.body;
        if (!name || typeof name !== 'string' || !sourcePath || typeof sourcePath !== 'string') {
            return res.status(400).json({ success: false, error: "name and path are required" });
        }
        const resolvedPath = path.resolve(sourcePath.trim());
        await validateSourcePath(resolvedPath, UPLOADS_DIR);
        const id = createSyncSource(name.trim(), resolvedPath, {
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            autoSync: !!autoSync,
            syncInterval: typeof syncInterval === 'number' ? syncInterval : 3600,
        });
        const source = getSyncSourceById(Number(id));
        res.status(201).json({ success: true, data: source });
    } catch (error: any) {
        console.error("Sync source add error:", error);
        res.status(400).json({ success: false, error: error.message || "Invalid path or failed to add source" });
    }
});

// Update sync source
app.put('/api/sync/sources/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid source id" });
        const source = getSyncSourceById(id);
        if (!source) return res.status(404).json({ success: false, error: "Sync source not found" });
        const { name, path: sourcePath, enabled, fromDate, toDate, autoSync, syncInterval } = req.body;
        const updates: { name?: string; path?: string; enabled?: boolean; fromDate?: string | null; toDate?: string | null; autoSync?: boolean; syncInterval?: number } = {};
        if (name !== undefined) updates.name = String(name).trim();
        if (enabled !== undefined) updates.enabled = !!enabled;
        if (fromDate !== undefined) updates.fromDate = fromDate === null || fromDate === '' ? null : String(fromDate);
        if (toDate !== undefined) updates.toDate = toDate === null || toDate === '' ? null : String(toDate);
        if (autoSync !== undefined) updates.autoSync = !!autoSync;
        if (syncInterval !== undefined) updates.syncInterval = Number(syncInterval);
        if (sourcePath !== undefined) {
            const resolvedPath = path.resolve(String(sourcePath).trim());
            await validateSourcePath(resolvedPath, UPLOADS_DIR);
            updates.path = resolvedPath;
        }
        updateSyncSource(id, updates);
        const updated = getSyncSourceById(id);
        res.json({ success: true, data: updated });
    } catch (error: any) {
        console.error("Sync source update error:", error);
        res.status(400).json({ success: false, error: error.message || "Failed to update source" });
    }
});

// Delete sync source
app.delete('/api/sync/sources/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid source id" });
        const source = getSyncSourceById(id);
        if (!source) return res.status(404).json({ success: false, error: "Sync source not found" });
        deleteSyncSource(id);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Sync source delete error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to delete source" });
    }
});

// Start sync
app.post('/api/sync/start/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid source id" });
        const source = getSyncSourceById(id);
        if (!source) return res.status(404).json({ success: false, error: "Sync source not found" });
        if (getActiveSyncTaskBySourceId(id)) {
            return res.status(409).json({ success: false, error: "A sync task is already running for this source" });
        }
        runSync(id, UPLOADS_DIR).catch((err) => console.error("Sync error:", err));
        res.status(202).json({ success: true, message: "Sync started" });
    } catch (error: any) {
        console.error("Sync start error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to start sync" });
    }
});

// Pause sync
app.post('/api/sync/pause/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid source id" });
        const state = getSyncRunState(id);
        if (!state) return res.status(404).json({ success: false, error: "No active sync for this source" });
        setSyncRunState(id, { ...state, paused: true });
        res.json({ success: true, message: "Sync paused" });
    } catch (error: any) {
        console.error("Sync pause error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to pause sync" });
    }
});

// Resume sync
app.post('/api/sync/resume/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid source id" });
        const state = getSyncRunState(id);
        if (!state) return res.status(404).json({ success: false, error: "No active sync for this source" });
        setSyncRunState(id, { ...state, paused: false });
        res.json({ success: true, message: "Sync resumed" });
    } catch (error: any) {
        console.error("Sync resume error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to resume sync" });
    }
});

// Get sync status
app.get('/api/sync/status/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid source id" });
        const source = getSyncSourceById(id);
        if (!source) return res.status(404).json({ success: false, error: "Sync source not found" });
        const task = getActiveSyncTaskBySourceId(id);
        const progress = getSyncProgress(id);
        res.json({ success: true, data: { source, task: task ?? null, progress: progress ?? null } });
    } catch (error: any) {
        console.error("Sync status error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to get sync status" });
    }
});

// Preview sync (scan only, no copy)
app.get('/api/sync/preview/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid source id" });
        const source = getSyncSourceById(id);
        if (!source) return res.status(404).json({ success: false, error: "Sync source not found" });
        await validateSourcePath(path.resolve(source.path), UPLOADS_DIR);
        const list = await scanSourceDirectory(path.resolve(source.path), {
            fromDate: source.from_date ?? undefined,
            toDate: source.to_date ?? undefined,
        });
        const totalSize = list.reduce((s, e) => s + e.size, 0);
        const limit = Math.min(100, list.length);
        const files = list.slice(0, limit).map((e) => ({ path: e.path, size: e.size, mtime: e.mtime.toISOString() }));
        res.json({ success: true, data: { totalFiles: list.length, totalSize, files } });
    } catch (error: any) {
        console.error("Sync preview error:", error);
        res.status(400).json({ success: false, error: error.message || "Failed to preview sync" });
    }
});

// Reset deleted records for a source
app.post('/api/sync/reset-records/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid source id" });
        const source = getSyncSourceById(id);
        if (!source) return res.status(404).json({ success: false, error: "Sync source not found" });
        resetDeletedRecordsBySourceId(id);
        res.json({ success: true, message: "Deleted records reset" });
    } catch (error: any) {
        console.error("Sync reset-records error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to reset records" });
    }
});

// SSE: sync progress events
app.get('/api/sync/events/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ success: false, error: "Invalid source id" });
        return;
    }
    const source = getSyncSourceById(id);
    if (!source) {
        res.status(404).json({ success: false, error: "Sync source not found" });
        return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (data: object) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        res.flush?.();
    };

    const interval = setInterval(() => {
        if (res.writableEnded) {
            clearInterval(interval);
            return;
        }
        const progress = getSyncProgress(id);
        if (progress) {
            send({
                status: progress.status,
                processedFiles: progress.processedFiles,
                totalFiles: progress.totalFiles,
                copiedSize: progress.copiedSize,
                totalSize: progress.totalSize,
                logLines: progress.logLines,
            });
            if (['completed', 'failed', 'cancelled'].includes(progress.status)) {
                clearInterval(interval);
                res.end();
            }
        }
    }, 1000);

    req.on('close', () => {
        clearInterval(interval);
        if (!res.writableEnded) res.end();
    });
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

// Get system prompt settings
app.get('/api/settings/system-prompt', async (req, res) => {
    try {
        const { getSystemPrompt } = await import('../services/geminiService.js');
        const prompt = getSystemPrompt();
        res.json({ success: true, data: { content: prompt } });
    } catch (error: any) {
        console.error("Get System Prompt API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to read system prompt" });
    }
});

// Update system prompt settings
app.put('/api/settings/system-prompt', async (req, res) => {
    try {
        const { content } = req.body;
        
        // Validate that content is a string
        if (typeof content !== 'string') {
            return res.status(400).json({ success: false, error: "Invalid format: content must be a string" });
        }
        
        const configPath = path.join(CONFIG_DIR, 'system-prompt.json');
        
        // Ensure config directory exists
        try {
            await fs.access(CONFIG_DIR);
        } catch {
            await fs.mkdir(CONFIG_DIR, { recursive: true });
        }
        
        // Write to file with pretty formatting
        await fs.writeFile(configPath, JSON.stringify({ content }, null, 2), 'utf-8');
        
        // Reload the prompt in memory for both services
        const geminiService = await import('../services/geminiService.js');
        const openaiService = await import('../services/openaiService.js');
        
        const geminiReloaded = geminiService.reloadSystemPrompt();
        const openaiReloaded = openaiService.reloadSystemPrompt();
        
        res.json({ 
            success: true, 
            message: "System prompt updated successfully",
            reloaded: {
                gemini: geminiReloaded,
                openai: openaiReloaded
            }
        });
    } catch (error: any) {
        console.error("Update System Prompt API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to update system prompt" });
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

// ============================================
// AI Settings API
// ============================================

// Get AI settings (API keys masked)
app.get('/api/settings/ai', async (req, res) => {
    try {
        const { getAiConfigForClient } = await import('../services/aiConfigService.js');
        const config = getAiConfigForClient();
        res.json({ success: true, data: config });
    } catch (error: any) {
        console.error("Get AI Settings API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to read AI settings" });
    }
});

// Update AI settings
app.put('/api/settings/ai', async (req, res) => {
    try {
        const { mergePartialConfig, saveAiConfig } = await import('../services/aiConfigService.js');
        
        const partialConfig = req.body;
        
        // Validate provider
        if (partialConfig.provider && !['gemini', 'openai'].includes(partialConfig.provider)) {
            return res.status(400).json({ success: false, error: "Invalid provider. Must be 'gemini' or 'openai'" });
        }
        
        // Merge with existing config
        const newConfig = mergePartialConfig(partialConfig);
        
        // Save config
        const saved = await saveAiConfig(newConfig);
        
        if (saved) {
            res.json({ 
                success: true, 
                message: "AI settings updated and services reloaded"
            });
        } else {
            res.status(500).json({ success: false, error: "Failed to save AI settings" });
        }
    } catch (error: any) {
        console.error("Update AI Settings API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to update AI settings" });
    }
});

// Get Gemini models list
app.post('/api/models/gemini', async (req, res) => {
    try {
        const { apiKey } = req.body;
        const { listModels } = await import('../services/geminiService.js');
        
        const models = await listModels(apiKey);
        res.json({ success: true, data: models });
    } catch (error: any) {
        console.error("Get Gemini Models API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch Gemini models" });
    }
});

// Get OpenAI compatible models list
app.post('/api/models/openai', async (req, res) => {
    try {
        const { apiKey, baseUrl } = req.body;
        const { listModels } = await import('../services/openaiService.js');
        
        const models = await listModels(apiKey, baseUrl);
        res.json({ success: true, data: models });
    } catch (error: any) {
        console.error("Get OpenAI Models API Error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch OpenAI models" });
    }
});

// Test API connection
app.post('/api/test-connection', async (req, res) => {
    try {
        const { provider, apiKey, baseUrl } = req.body;
        
        if (!provider || !['gemini', 'openai'].includes(provider)) {
            return res.status(400).json({ success: false, error: "Invalid provider" });
        }
        
        let result: { success: boolean; message: string; model?: string };
        
        if (provider === 'gemini') {
            const { testConnection } = await import('../services/geminiService.js');
            result = await testConnection(apiKey);
        } else {
            const { testConnection } = await import('../services/openaiService.js');
            result = await testConnection(apiKey, baseUrl);
        }
        
        res.json(result);
    } catch (error: any) {
        console.error("Test Connection API Error:", error);
        res.status(500).json({ success: false, message: error.message || "Connection test failed" });
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
        // 局域网访问时需配置 HMR：使 HMR 客户端连接到正确的 host:port，避免显示异常
        const hmrHost = process.env.HMR_HOST; // 例: 10.126.126.5（本机在 10.126.126.0/24 网段的 IP）
        const vite = await createViteServer({
            server: {
                middlewareMode: true,
                host: true,
                hmr: hmrHost
                    ? { host: hmrHost, clientPort: PORT }
                    : { clientPort: PORT }
            },
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
