import fs from 'fs/promises';
import type { ImageMetadata } from '../types.ts';

export const parseImageFile = async (filePath: string): Promise<ImageMetadata> => {
    const textChunks = await extractPngTextChunks(filePath);
    
    // Check for ComfyUI (stores JSON in 'prompt' or 'workflow')
    if (textChunks['prompt']) {
        return parseComfyMetadata(textChunks['prompt']);
    }
    
    // Check for SD WebUI (stores text in 'parameters')
    if (textChunks['parameters']) {
        return parseSdMetadata(textChunks['parameters']);
    }
    
    return {
        type: 'Unknown',
        checkpoints: [],
        loras: [],
        prompts: [],
        negative_prompts: [],
        sampler: {},
        image_size: []
    };
};

const extractPngTextChunks = async (filePath: string): Promise<Record<string, string>> => {
    const buffer = await fs.readFile(filePath);
    // Node.js Buffer is compatible with DataView/Uint8Array operations or we can use Buffer methods
    // Converting to Uint8Array for existing logic compatibility or using Buffer directly
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const chunks: Record<string, string> = {};
    
    // PNG Signature: 89 50 4E 47 0D 0A 1A 0A
    if (view.getUint32(0) !== 0x89504E47) return chunks;
    
    let offset = 8;
    const decoder = new TextDecoder('iso-8859-1'); 

    while (offset < view.byteLength) {
        // Chunk Length (4 bytes)
        const length = view.getUint32(offset);
        // Chunk Type (4 bytes)
        const type = new TextDecoder('ascii').decode(buffer.subarray(offset + 4, offset + 8));
        
        if (type === 'tEXt') {
            const data = buffer.subarray(offset + 8, offset + 8 + length);
            // tEXt format: keyword + null separator + text
            const uint8 = new Uint8Array(data);
            let nullIndex = -1;
            for(let i=0; i<uint8.length; i++) {
                if(uint8[i] === 0) {
                    nullIndex = i;
                    break;
                }
            }
            if (nullIndex !== -1) {
                const keyword = decoder.decode(data.subarray(0, nullIndex));
                const text = new TextDecoder('utf-8').decode(data.subarray(nullIndex + 1));
                chunks[keyword] = text;
            }
        }
        
        offset += 12 + length; // Length(4) + Type(4) + Data(length) + CRC(4)
    }
    
    return chunks;
}

function parseComfyMetadata(promptJson: string): ImageMetadata {
    const summary: ImageMetadata = {
        type: 'ComfyUI',
        checkpoints: [],
        loras: [],
        prompts: [],
        negative_prompts: [],
        sampler: {},
        image_size: []
    };
    
    try {
        const data = JSON.parse(promptJson);
        for (const node of Object.values(data) as any[]) {
            const classType = node.class_type || "";
            const inputs = node.inputs || {};
            
            if (classType.includes("CheckpointLoader") || classType.includes("Load Checkpoint")) {
                const ckpt = inputs.ckpt_name || inputs.chkpt_name;
                if (ckpt) summary.checkpoints.push(ckpt);
            }
            
            if (classType.includes("LoraLoader")) {
                const lora = inputs.lora_name;
                if (lora) summary.loras.push(lora);
            }
            
            if (classType.includes("CLIPTextEncode") || classType.includes("Prompt")) {
                const text = inputs.text || inputs.text_g || inputs.text_l;
                if (text && typeof text === 'string' && text.length > 0) {
                     const lower = text.toLowerCase();
                     if (lower.includes("worst quality") || lower.includes("bad anatomy") || lower.includes("nsfw")) {
                         summary.negative_prompts.push(text.trim());
                     } else {
                         summary.prompts.push(text.trim());
                     }
                }
            }
            
            if (classType.includes("KSampler")) {
                summary.sampler.seed = inputs.seed;
                summary.sampler.steps = inputs.steps;
                summary.sampler.cfg = inputs.cfg;
                summary.sampler.sampler_name = inputs.sampler_name;
                summary.sampler.scheduler = inputs.scheduler;
            }
            
            if (classType.includes("EmptyLatentImage")) {
                const w = inputs.width;
                const h = inputs.height;
                if (w && h) summary.image_size.push(`${w}x${h}`);
            }
        }
    } catch (e) { 
        console.error("Comfy Parse Error", e); 
    }
    
    // Deduplicate
    summary.checkpoints = [...new Set(summary.checkpoints)];
    summary.loras = [...new Set(summary.loras)];
    
    return summary;
}

function parseSdMetadata(paramsText: string): ImageMetadata {
    const summary: ImageMetadata = {
        type: 'SD WebUI',
        prompts: [],
        negative_prompts: [],
        sampler: {},
        checkpoints: [],
        loras: [],
        image_size: []
    };
    
    const parts = paramsText.split("Negative prompt:");
    const positive = parts[0].trim();
    if (positive) summary.prompts.push(positive);
    
    let remainder = parts.length > 1 ? parts[1] : "";
    
    // Edge case handling if Negative prompt label is missing but Steps exists
    if (!remainder && parts[0].includes("\nSteps:")) {
        const pParts = parts[0].split("\nSteps:");
        summary.prompts = [pParts[0].trim()];
        if (pParts.length > 1) remainder = "Steps:" + pParts[1];
    }
    
    let negative = "";
    let settings = "";
    
    // Find the start of settings (usually "Steps: ...")
    const settingsMatch = remainder.match(/\nSteps: \d+,/);
    if (settingsMatch && settingsMatch.index !== undefined) {
        negative = remainder.substring(0, settingsMatch.index).trim();
        settings = remainder.substring(settingsMatch.index).trim();
    } else {
        negative = remainder.trim();
    }
    
    if (negative) summary.negative_prompts.push(negative);
    
    if (settings) {
        const pairs = settings.split(",").map(s => s.trim());
        pairs.forEach(p => {
             // Handle simple K: V pairs, being careful about colons in values
             const colonIdx = p.indexOf(':');
             if (colonIdx > -1) {
                 const k = p.substring(0, colonIdx).trim();
                 const v = p.substring(colonIdx + 1).trim();
                 
                 if (k === "Steps") summary.sampler.steps = v;
                 if (k === "Sampler") summary.sampler.sampler_name = v;
                 if (k === "CFG scale") summary.sampler.cfg = v;
                 if (k === "Seed") summary.sampler.seed = v;
                 if (k === "Size") summary.image_size.push(v);
                 if (k === "Model") summary.checkpoints.push(v);
             }
        });
    }
    
    // Extract LoRAs from prompt like <lora:name:1.0>
    const loraRegex = /<lora:([^:>]+)(?::[^>]+)?>/g;
    let match;
    while ((match = loraRegex.exec(positive)) !== null) {
        summary.loras.push(match[1]);
    }
    
    return summary;
}
