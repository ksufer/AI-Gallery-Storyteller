import type { ImageMetadata } from '../types.ts';

/** SD WebUI txt2img API request body (subset we use). */
export interface Txt2ImgPayload {
    prompt: string;
    negative_prompt: string;
    steps: number;
    cfg_scale: number;
    sampler_name: string;
    seed: number;
    width: number;
    height: number;
    override_settings?: { sd_model_checkpoint?: string };
}

/** SD WebUI txt2img API response. */
export interface Txt2ImgResponse {
    images: string[];
    parameters: Record<string, unknown>;
    info: string;
}

const DEFAULT_WIDTH = 512;
const DEFAULT_HEIGHT = 768;
const DEFAULT_SAMPLER = 'DPM++ 2M Karras';
const TXT2IMG_TIMEOUT_MS = 300000; // 5 minutes

/**
 * Parse "WxH" from metadata.image_size[0].
 * @returns [width, height] or [DEFAULT_WIDTH, DEFAULT_HEIGHT]
 */
function parseSize(imageSize: string[] | undefined): [number, number] {
    const raw = imageSize?.[0]?.trim();
    if (!raw) return [DEFAULT_WIDTH, DEFAULT_HEIGHT];
    const parts = raw.split(/[x×X]/).map((s) => parseInt(s.trim(), 10));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]];
    }
    return [DEFAULT_WIDTH, DEFAULT_HEIGHT];
}

/**
 * Build SD WebUI txt2img payload from gallery image metadata (SD WebUI type).
 * Seed is set to -1 for a new random image ("做同款" = same params, new image).
 */
export function buildTxt2ImgPayload(metadata: ImageMetadata): Txt2ImgPayload {
    const [width, height] = parseSize(metadata.image_size);
    const steps = Number(metadata.sampler?.steps) || 20;
    const cfg = Number(metadata.sampler?.cfg) || 7;
    const samplerName = (metadata.sampler?.sampler_name as string) || DEFAULT_SAMPLER;
    const payload: Txt2ImgPayload = {
        prompt: metadata.prompts?.[0] ?? '',
        negative_prompt: metadata.negative_prompts?.[0] ?? '',
        steps,
        cfg_scale: cfg,
        sampler_name: samplerName,
        seed: -1,
        width,
        height,
    };
    if (metadata.checkpoints?.[0]) {
        payload.override_settings = { sd_model_checkpoint: metadata.checkpoints[0] };
    }
    return payload;
}

/**
 * Call SD WebUI txt2img API.
 * @param baseUrl - e.g. http://127.0.0.1:7860
 * @param payload - Request body from buildTxt2ImgPayload
 * @returns API response with base64 images
 */
export async function generateTxt2Img(
    baseUrl: string,
    payload: Txt2ImgPayload
): Promise<Txt2ImgResponse> {
    const url = baseUrl.replace(/\/$/, '') + '/sdapi/v1/txt2img';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TXT2IMG_TIMEOUT_MS);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`SD WebUI API error ${res.status}: ${text || res.statusText}`);
        }
        const data = (await res.json()) as Txt2ImgResponse;
        if (!data.images || !Array.isArray(data.images)) {
            throw new Error('Invalid SD WebUI response: missing images');
        }
        return data;
    } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof Error) {
            if (err.name === 'AbortError') {
                throw new Error('SD WebUI 请求超时，请稍后重试');
            }
            throw err;
        }
        throw new Error('SD WebUI 请求失败');
    }
}
