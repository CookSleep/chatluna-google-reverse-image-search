import { createHash } from 'node:crypto';
import { Schema } from '@chatluna/schema';
import { defineTool } from '@chatluna/tool';
import { fileRefTableOf } from '@chatluna/transform';
export * from './config.js';
export const inject = ['tools', 'http', 'model', 'database', 'chatluna_storage'];
const CACHE_TABLE = 'chatluna_reverse_image_v2_cache';
function isScrapingdogReachableUrl(url) {
    try {
        const u = new URL(url);
        if (u.username || u.password || !/^https?:$/i.test(u.protocol))
            return false;
        const host = u.hostname.toLowerCase();
        if (!host)
            return false;
        if (host === 'localhost'
            || host === '127.0.0.1'
            || host === '::1'
            || host === '0.0.0.0'
            || host === 'koishi'
            || host.endsWith('.local')
            || !host.includes('.')) {
            return false;
        }
        if (isPrivateIPv4(host))
            return false;
        return true;
    }
    catch {
        return false;
    }
}
function isPrivateIPv4(host) {
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m)
        return false;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10)
        return true;
    if (a === 127)
        return true;
    if (a === 192 && b === 168)
        return true;
    if (a === 172 && b >= 16 && b <= 31)
        return true;
    if (a === 169 && b === 254)
        return true;
    return false;
}
// Scrapingdog can include a credential-bearing google_goto_link. Copy only model-facing fields.
function publicMatches(matches, apiKey) {
    return matches.filter(item => item && typeof item === 'object').map(item => {
        const match = {};
        for (const field of ['title', 'source', 'link', 'url', 'thumbnail', 'image']) {
            const value = item[field];
            if (typeof value === 'string' && !value.includes(apiKey) && !value.includes(encodeURIComponent(apiKey))) {
                match[field] = value;
            }
        }
        return match;
    });
}
function shouldCacheResult(result) {
    if (result.provider === 'google') {
        const web = result.webDetection;
        return !!(web.pagesWithMatchingImages?.length
            || web.webEntities?.length
            || web.bestGuessLabels?.length);
    }
    const lensRaw = result.lens_results;
    if (Array.isArray(lensRaw) && lensRaw.length === 1 && typeof lensRaw[0] === 'string') {
        const msg = lensRaw[0].toLowerCase();
        if (msg.includes("didn't return any results") || msg.includes('no results')) {
            return false;
        }
    }
    const exact = result.exact_matches;
    const lens = Array.isArray(lensRaw) ? lensRaw : [];
    const visual = result.visual_matches;
    return !!((Array.isArray(exact) && exact.length)
        || lens.length
        || (Array.isArray(visual) && visual.length));
}
function messagesOf(agent) {
    const session = agent && 'session' in agent ? agent.session : undefined;
    if (!session || typeof session !== 'object' || !('messages' in session))
        return [];
    return typeof session.messages === 'function' ? session.messages() : [];
}
function publicFile(base, path) {
    const url = base.trim().replace(/\/+$/, '') + path;
    if (!base.trim() || !isScrapingdogReachableUrl(url)) {
        throw new Error('请配置实例的公网地址，使 Scrapingdog 可以读取 /files/ 下的聊天图片。');
    }
    return url;
}
async function resolveImage(ctx, cfg, input, agent) {
    if (/^https?:\/\//i.test(input)) {
        if (!isScrapingdogReachableUrl(input))
            throw new Error('请使用公网图片 URL 或当前对话中的图片 ref。');
        return { url: input };
    }
    if (!/^i?[0-9a-f]{6,64}$/.test(input))
        throw new Error('请输入当前对话的图片 ref 或公网图片 URL。');
    const block = fileRefTableOf(messagesOf(agent)).resolve(input);
    if (!block?.mediaType.startsWith('image/'))
        throw new Error('当前对话中找不到对应图片。');
    const data = block.data;
    if (data.type === 'url' && isScrapingdogReachableUrl(data.url))
        return { url: data.url };
    if (data.type === 'reference' && data.reference.startsWith('storage://')) {
        const file = await ctx.chatluna_storage.getTempFile(data.reference.slice(10));
        if (!file)
            throw new Error('聊天图片已过期，请重新发送。');
        return cfg.provider === 'google' ? { content: (await file.data).toString('base64') }
            : { url: publicFile(cfg.serverPath, file.url) };
    }
    if (data.type !== 'data')
        throw new Error('该图片没有可用的内容，请重新发送。');
    if (cfg.provider === 'google')
        return { content: data.data };
    const file = await ctx.chatluna_storage.createTempFile(Buffer.from(data.data, 'base64'), 'image', { mimeType: block.mediaType });
    return { url: publicFile(cfg.serverPath, file.url) };
}
async function search(ctx, cfg, image, input, signal) {
    const options = {
        signal, timeout: cfg.timeoutSeconds * 1000, validateStatus: () => true,
        ...(cfg.proxyMode === 'system' ? {} : { proxyAgent: cfg.proxyMode === 'off' ? '' : cfg.proxyAddress || '' })
    };
    if (cfg.provider === 'google') {
        const response = await ctx.http('https://vision.googleapis.com/v1/images:annotate', {
            ...options, method: 'POST', headers: { 'X-Goog-Api-Key': cfg.apiKey },
            data: { requests: [{ image: 'content' in image ? image : { source: { imageUri: image.url } },
                        features: [{ type: 'WEB_DETECTION', maxResults: cfg.maxResults }] }] }
        });
        const data = await response.json();
        const first = data.responses?.[0];
        if (!response.ok || first?.error || !first?.webDetection) {
            throw new Error(first?.error?.message || data.error?.message || 'Google Vision 查询失败，HTTP ' + response.status);
        }
        const web = first.webDetection;
        return { provider: 'google', imageUrl: input, webDetection: {
                pagesWithMatchingImages: (web.pagesWithMatchingImages || []).filter(item => item.url).slice(0, cfg.maxResults),
                webEntities: (web.webEntities || []).map(({ entityId, ...entity }) => entity).slice(0, cfg.maxResults),
                bestGuessLabels: web.bestGuessLabels || []
            } };
    }
    if (!('url' in image))
        throw new Error('Scrapingdog 需要公网图片地址。');
    const endpoint = new URL('https://api.scrapingdog.com/google_lens');
    endpoint.search = new URLSearchParams({ api_key: cfg.apiKey, exact_matches: 'true',
        url: 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(image.url) }).toString();
    const response = await ctx.http(endpoint, options).catch((error) => {
        signal.throwIfAborted();
        throw new Error(error instanceof Error ? error.message.replaceAll(encodeURIComponent(cfg.apiKey), '[redacted]').replaceAll(cfg.apiKey, '[redacted]') : 'Scrapingdog 连接失败。');
    });
    const data = await response.json();
    if (!response.ok || data.error)
        throw new Error('Scrapingdog 查询失败，HTTP ' + response.status);
    const result = { provider: 'scrapingdog', imageUrl: input };
    for (const key of ['exact_matches', 'visual_matches', 'lens_results']) {
        if (!Array.isArray(data[key]))
            continue;
        const matches = publicMatches(data[key].slice(0, cfg.maxResults), cfg.apiKey);
        for (const item of matches) {
            if (typeof item !== 'object' || !item?.thumbnail?.startsWith('data:'))
                continue;
            const thumbnail = /^data:(image\/[\w.+-]+);base64,(.+)$/i.exec(item.thumbnail);
            delete item.thumbnail;
            if (!cfg.cacheService.cacheThumbnails || !thumbnail?.[1] || !thumbnail[2])
                continue;
            try {
                const file = await ctx.chatluna_storage.createTempFile(Buffer.from(thumbnail[2], 'base64'), 'thumbnail', {
                    mimeType: thumbnail[1], expireHours: Math.max(1, Math.ceil(cfg.cacheService.ttlSeconds / 3600))
                });
                item.thumbnail = cfg.serverPath ? publicFile(cfg.serverPath, file.url) : 'storage://' + file.id;
            }
            catch { /* 来源网页在缩略图不可用时仍可返回。 */ }
        }
        result[key] = matches;
    }
    return result;
}
export function apply(ctx, cfg) {
    if (!cfg.tool.enabled || !cfg.apiKey.trim())
        return;
    ctx.model.extend(CACHE_TABLE, { key: 'string', payload: 'text', createdAt: 'timestamp', expiresAt: 'timestamp' }, { primary: 'key', indexes: [['expiresAt']] });
    let nextCleanup = 0;
    ctx.tools.define(defineTool({
        name: cfg.tool.name, description: cfg.tool.description,
        args: Schema.object({ imageUrl: Schema.string().required().description('当前对话中图片的 ref（如 i123abc）或公网图片 URL。') }),
        traits: { effect: 'read', parallel: true },
        async run({ imageUrl }, call) {
            call.signal.throwIfAborted();
            const input = imageUrl.trim();
            const image = await resolveImage(ctx, cfg, input, call.agent);
            const key = createHash('sha256').update(JSON.stringify([2, cfg.provider, cfg.maxResults, cfg.serverPath,
                cfg.cacheService.cacheThumbnails, image])).digest('hex');
            const now = Date.now();
            call.signal.throwIfAborted();
            let result;
            if (cfg.cacheService.enable) {
                if (now >= nextCleanup) {
                    await ctx.database.remove(CACHE_TABLE, { expiresAt: { $lte: new Date(now) } });
                    nextCleanup = now + cfg.cacheService.cleanupIntervalSeconds * 1000;
                }
                const [row] = await ctx.database.get(CACHE_TABLE, { key, expiresAt: { $gt: new Date(now) } });
                if (row) {
                    result = JSON.parse(row.payload);
                    if (result?.provider === 'scrapingdog') {
                        const ids = new Set();
                        const names = new Set();
                        const prefix = cfg.serverPath.trim().replace(/\/+$/, '') + '/files/';
                        for (const item of [...result.exact_matches || [], ...result.visual_matches || [], ...result.lens_results || []]) {
                            if (item?.thumbnail?.startsWith('storage://'))
                                ids.add(item.thumbnail.slice(10));
                            else if (item?.thumbnail?.startsWith(prefix))
                                names.add(decodeURIComponent(item.thumbnail.slice(prefix.length)));
                        }
                        const filter = { expireAt: { $gt: Date.now() } };
                        if ((ids.size && (await ctx.database.get('chatluna_files', { id: [...ids], ...filter }, ['id'])).length !== ids.size)
                            || (names.size && (await ctx.database.get('chatluna_files', { name: [...names], ...filter }, ['name'])).length !== names.size)) {
                            result = undefined;
                        }
                    }
                }
            }
            if (!result) {
                result = await search(ctx, cfg, image, input, call.signal);
                call.signal.throwIfAborted();
                if (cfg.cacheService.enable && shouldCacheResult(result))
                    await ctx.database.upsert(CACHE_TABLE, [{
                            key, payload: JSON.stringify(result), createdAt: new Date(now), expiresAt: new Date(now + cfg.cacheService.ttlSeconds * 1000)
                        }], ['key']);
            }
            else if (cfg.debug)
                ctx.logger.info('以图搜图缓存命中。');
            return { ...result, imageUrl: input, ...(cfg.customPrompt.trim() ? { instructions: cfg.customPrompt } : {}) };
        }
    }));
}
