import { StructuredTool } from '@langchain/core/tools'
import { Context } from 'koishi'
import type { ChatLunaToolRunnable } from 'koishi-plugin-chatluna/llm-core/platform/types'
import { z } from 'zod'
import { Config, name } from './config'

const CACHE_TABLE = 'chatluna_google_reverse_image_cache'

type StorageService = {
    config?: {
        serverPath?: string
    }
    createTempFile: (buffer: Buffer, filename: string, ttlHours: number) => Promise<{ url: string }>
}

type WebDetection = {
    webEntities?: Array<{ entityId?: string; score?: number; description?: string }>
    fullMatchingImages?: Array<{ url?: string }>
    partialMatchingImages?: Array<{ url?: string }>
    pagesWithMatchingImages?: Array<{ url?: string; pageTitle?: string }>
    visuallySimilarImages?: Array<{ url?: string }>
    bestGuessLabels?: Array<{ label?: string; languageCode?: string }>
}

type VisionResponse = {
    responses?: Array<{
        webDetection?: WebDetection
        error?: { message?: string }
    }>
    error?: { message?: string }
}

type ScrapingdogResponse = {
    html?: unknown
    exact_matches?: Array<{
        title?: string
        source?: string
        link?: string
        url?: string
        thumbnail?: string
        image?: string
    }>
    visual_matches?: Array<{
        title?: string
        source?: string
        link?: string
        url?: string
        thumbnail?: string
        image?: string
    }>
    lens_results?: Array<{
        title?: string
        source?: string
        link?: string
        url?: string
        thumbnail?: string
        image?: string
    }>
    related_searches?: Array<{
        title?: string
    }>
    error?: string
}

type GoogleResultPayload = {
    provider: 'google'
    imageUrl: string
    webDetection: WebDetection
}

type ScrapingdogResultPayload = {
    provider: 'scrapingdog'
    imageUrl: string
} & Omit<ScrapingdogResponse, 'related_searches'>

type OutputPayload = GoogleResultPayload | ScrapingdogResultPayload

type CacheRow = {
    key: string
    payload: OutputPayload
    createdAt: Date
    expiresAt: string | number | Date
}

declare module 'koishi' {
    interface Tables {
        chatluna_google_reverse_image_cache: CacheRow
    }

    interface Context {
        chatluna_storage?: StorageService
    }
}

class ReverseImageCacheService {
    initialized = false
    cleanupRunning = false
    lastCleanupAt = 0

    constructor(
        private ctx: Context,
        private cfg: Config
    ) { }

    async init() {
        this.initialized = true
        await this.cleanupExpired()
    }

    async ensureReady() {
        if (this.initialized) return
        await this.init()
    }

    async get(key: string): Promise<OutputPayload | null> {
        if (!this.cfg.cacheService.enable) return null
        await this.ensureReady()
        await this.maybeCleanup()
        const db = this.ctx.database as any
        const rows = await db.get(
            CACHE_TABLE,
            { key },
            ['key', 'payload', 'expiresAt']
        )
        const row = rows[0] as CacheRow | undefined
        if (!row) return null
        const expiresAtMs = Date.parse(String(row.expiresAt))
        if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
            await db.remove(CACHE_TABLE, { key })
            return null
        }
        return row.payload
    }

    async set(key: string, payload: OutputPayload): Promise<void> {
        if (!this.cfg.cacheService.enable) return
        await this.ensureReady()
        await this.maybeCleanup()
        const now = new Date()
        const expiresAt = new Date(
            now.getTime() + this.cfg.cacheService.ttlSeconds * 1000
        )
        const db = this.ctx.database as any
        await db.upsert(
            CACHE_TABLE,
            [{
                key,
                payload,
                createdAt: now,
                expiresAt
            }],
            ['key']
        )
    }

    async maybeCleanup() {
        const now = Date.now()
        if (
            now - this.lastCleanupAt
            < this.cfg.cacheService.cleanupIntervalSeconds * 1000
        ) {
            return
        }
        this.lastCleanupAt = now
        await this.cleanupExpired()
    }

    async cleanupExpired() {
        if (this.cleanupRunning) return
        this.cleanupRunning = true
        try {
            const db = this.ctx.database as any
            await db.remove(CACHE_TABLE, {
                expiresAt: { $lte: new Date() }
            })
        } finally {
            this.cleanupRunning = false
        }
    }
}

const schema = z.object({
    imageUrl: z.string().url().describe('需要执行以图搜图的图像 URL。')
})

class GoogleReverseImageTool extends StructuredTool {
    name: string
    description: string
    schema = schema

    constructor(
        private ctx: Context,
        private cfg: Config,
        private cache: ReverseImageCacheService
    ) {
        super({})
        this.name = (cfg.tool.name || 'google_reverse_image_search').trim()
        this.description =
            (cfg.tool.description || '').trim()
            || '使用 Google Detecting Web 进行以图搜图，输入图像 URL 并返回匹配线索。'
    }

    async _call(
        input: z.infer<typeof schema>,
        _runManager: unknown,
        _runnable: ChatLunaToolRunnable
    ) {
        const log = this.ctx.logger(name)
        const url = input.imageUrl.trim()
        const scrapingdogImageUrl = this.cfg.provider === 'scrapingdog'
            ? rewriteImageUrlForScrapingdog(this.ctx, this.cfg, url)
            : url
        const key = `v1:${this.cfg.provider}:max=${this.cfg.maxResults}:serverPath=${trimTrailingSlash((this.cfg.serverPath || '').trim())}:${scrapingdogImageUrl}`
        try {
            const hit = await this.cache.get(key)
            if (hit) {
                const shouldRefreshScrapingdog = await needRefreshScrapingdogCache(this.ctx, this.cfg, hit)
                if (shouldRefreshScrapingdog) {
                    if (this.cfg.debug) {
                        log.info('检测到 Scrapingdog 缩略图缓存失效，准备重新请求并覆盖缓存：%s', key)
                    }
                } else {
                    if (this.cfg.debug) {
                        log.info('缓存命中：%s', key)
                    }
                    return JSON.stringify(attachNote(hit, this.cfg), null, 2)
                }
            }

            if (this.cfg.debug) {
                log.info('缓存未命中：%s', key)
            }

            let out: OutputPayload
            if (this.cfg.provider === 'scrapingdog') {
                out = await callScrapingdog(this.ctx, url, this.cfg)
            } else {
                out = await callGoogleVision(url, this.cfg)
            }

            if (shouldCacheResult(out)) {
                await this.cache.set(key, out)
                if (this.cfg.debug) {
                    log.info('缓存写入：%s', key)
                }
            } else if (this.cfg.debug) {
                log.info('检测到失败结果，跳过缓存写入：%s', key)
            }
            return JSON.stringify(attachNote(out, this.cfg), null, 2)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            if (this.cfg.debug) {
                log.error(err)
            }
            return `以图搜图失败：${msg}`
        }
    }
}

async function callGoogleVision(imageUrl: string, cfg: Config): Promise<GoogleResultPayload> {
    const imgRes = await fetch(imageUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(cfg.timeoutSeconds * 1000)
    })
    if (!imgRes.ok) {
        throw new Error(`获取图像失败：HTTP ${imgRes.status}`)
    }
    const bytes = Buffer.from(await imgRes.arrayBuffer())
    const base64Url = bytes.toString('base64')

    const apiRes = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(cfg.apiKey)}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({
                requests: [
                    {
                        image: {
                            content: base64Url
                        },
                        features: [
                            {
                                maxResults: cfg.maxResults,
                                type: 'WEB_DETECTION'
                            }
                        ]
                    }
                ]
            }),
            signal: AbortSignal.timeout(cfg.timeoutSeconds * 1000)
        }
    )

    const data = await apiRes.json() as VisionResponse
    if (!apiRes.ok) {
        throw new Error(`Google Vision 请求失败：${data.error?.message || `HTTP ${apiRes.status}`}`)
    }

    const first = data.responses?.[0]
    if (first?.error?.message) {
        throw new Error(`Google Vision 返回错误：${first.error.message}`)
    }

    const web = first?.webDetection
    if (!web) {
        throw new Error('Google Vision 没有返回可用的 webDetection 结果。')
    }

    const pages = (web.pagesWithMatchingImages || [])
        .filter((item) => item.url)
        .map((item) => ({
            url: item.url,
            pageTitle: item.pageTitle || ''
        }))

    return {
        provider: 'google',
        imageUrl,
        webDetection: {
            webEntities: (web.webEntities || []).map((item) => ({
                score: item.score,
                description: item.description
            })),
            fullMatchingImages: [],
            partialMatchingImages: [],
            pagesWithMatchingImages: pages,
            visuallySimilarImages: [],
            bestGuessLabels: web.bestGuessLabels || []
        }
    }
}

async function callScrapingdog(ctx: Context, imageUrl: string, cfg: Config): Promise<ScrapingdogResultPayload> {
    const rewrittenImageUrl = rewriteImageUrlForScrapingdog(ctx, cfg, imageUrl)

    if (!isScrapingdogReachableUrl(rewrittenImageUrl)) {
        throw new Error('Scrapingdog 需要可被公网访问的图像 URL。当前 URL 很可能是内网地址（例如 localhost、127.0.0.1、koishi 容器域名或私网 IP），Scrapingdog 无法抓取。')
    }

    const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(rewrittenImageUrl)}`
    const params = new URLSearchParams({
        api_key: cfg.apiKey,
        url: lensUrl,
        exact_matches: 'true'
    })
    const apiRes = await fetch(
        `https://api.scrapingdog.com/google_lens?${params.toString()}`,
        {
            method: 'GET',
            signal: AbortSignal.timeout(cfg.timeoutSeconds * 1000)
        }
    )
    const data = await apiRes.json() as ScrapingdogResponse
    if (!apiRes.ok) {
        throw new Error(`Scrapingdog 请求失败：${data.error || `HTTP ${apiRes.status}`}`)
    }

    const result: Omit<ScrapingdogResponse, 'related_searches'> = {
        ...data
    }
    delete (result as { related_searches?: unknown }).related_searches

    if (Array.isArray(result.exact_matches)) {
        result.exact_matches = result.exact_matches.slice(0, cfg.maxResults)
    }
    if (Array.isArray(result.lens_results)) {
        result.lens_results = result.lens_results.slice(0, cfg.maxResults)
    }
    if (Array.isArray(result.visual_matches)) {
        result.visual_matches = result.visual_matches.slice(0, cfg.maxResults)
    }

    stripScrapingdogExtraFields(result.exact_matches)
    stripScrapingdogExtraFields(result.lens_results)
    stripScrapingdogExtraFields(result.visual_matches)

    await cacheScrapingdogThumbnails(ctx, cfg, result)

    return {
        provider: 'scrapingdog',
        imageUrl,
        ...result
    }
}

async function cacheScrapingdogThumbnails(
    ctx: Context,
    cfg: Config,
    data: Omit<ScrapingdogResponse, 'related_searches'>
) {
    if (!cfg.cacheService.cacheThumbnails) return
    if (!hasStorageService(ctx)) return

    await rewriteThumbnailList(ctx, cfg, data.exact_matches)
    await rewriteThumbnailList(ctx, cfg, data.lens_results)
    await rewriteThumbnailList(ctx, cfg, data.visual_matches)
}

async function rewriteThumbnailList(
    ctx: Context,
    cfg: Config,
    list: ScrapingdogResponse['lens_results'] | ScrapingdogResponse['exact_matches'] | ScrapingdogResponse['visual_matches']
) {
    if (!Array.isArray(list) || !list.length) return

    const ttlHours = Math.max(1, Math.ceil(cfg.cacheService.ttlSeconds / 3600))

    for (let i = 0; i < list.length; i++) {
        const item = list[i]
        if (!item || typeof item !== 'object') continue
        const raw = typeof item.thumbnail === 'string' ? item.thumbnail : ''
        if (!raw.startsWith('data:')) continue

        try {
            const parsed = parseDataUrl(raw)
            if (!parsed) {
                delete item.thumbnail
                continue
            }

            const stored = await ctx.chatluna_storage!.createTempFile(
                parsed.buffer,
                `scrapingdog-thumb-${i + 1}${parsed.ext}`,
                ttlHours
            )
            item.thumbnail = stored.url
        } catch {
            delete item.thumbnail
        }
    }
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; ext: string } | null {
    const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/i)
    if (!match?.[2]) return null

    try {
        const mime = (match[1] || '').toLowerCase()
        const buffer = Buffer.from(match[2], 'base64')
        if (!buffer.length) return null
        return {
            buffer,
            ext: mimeToExt(mime)
        }
    } catch {
        return null
    }
}

function mimeToExt(mime: string) {
    if (mime.includes('png')) return '.png'
    if (mime.includes('webp')) return '.webp'
    if (mime.includes('gif')) return '.gif'
    return '.jpg'
}

function hasStorageService(ctx: Context) {
    return typeof ctx.chatluna_storage?.createTempFile === 'function'
}

function rewriteImageUrlForScrapingdog(ctx: Context, cfg: Config, imageUrl: string) {
    const publicServerPath = (cfg.serverPath || '').trim()
    if (!publicServerPath) return imageUrl

    const storageServerPath = (ctx.chatluna_storage?.config?.serverPath || '').trim()
    if (!storageServerPath) return imageUrl

    const normalizedStorage = trimTrailingSlash(storageServerPath)
    const normalizedPublic = trimTrailingSlash(publicServerPath)

    if (!normalizedStorage || !normalizedPublic) return imageUrl
    if (!imageUrl.startsWith(normalizedStorage)) return imageUrl

    return `${normalizedPublic}${imageUrl.slice(normalizedStorage.length)}`
}

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, '')
}

function isScrapingdogReachableUrl(url: string) {
    try {
        const u = new URL(url)
        if (!/^https?:$/i.test(u.protocol)) return false
        const host = u.hostname.toLowerCase()
        if (!host) return false
        if (
            host === 'localhost'
            || host === '127.0.0.1'
            || host === '::1'
            || host === '0.0.0.0'
            || host === 'koishi'
            || host.endsWith('.local')
            || !host.includes('.')
        ) {
            return false
        }
        if (isPrivateIPv4(host)) return false
        return true
    } catch {
        return false
    }
}

function isPrivateIPv4(host: string) {
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (!m) return false
    const a = Number(m[1])
    const b = Number(m[2])
    if (a === 10) return true
    if (a === 127) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 169 && b === 254) return true
    return false
}

function stripScrapingdogExtraFields(
    list: ScrapingdogResponse['lens_results'] | ScrapingdogResponse['exact_matches'] | ScrapingdogResponse['visual_matches']
) {
    if (!Array.isArray(list)) return
    for (const item of list) {
        if (!item || typeof item !== 'object') continue
        delete (item as { price?: unknown }).price
        delete (item as { in_stock?: unknown }).in_stock
    }
}

async function needRefreshScrapingdogCache(ctx: Context, cfg: Config, hit: OutputPayload) {
    if (hit.provider !== 'scrapingdog') return false
    if (!cfg.cacheService.cacheThumbnails) return false

    const urls = collectStorageThumbnailUrls(hit)
    if (!urls.length) return false

    for (const url of urls) {
        const ok = await checkUrlAlive(url, cfg.timeoutSeconds)
        if (!ok) {
            return true
        }
    }

    return false
}

function collectStorageThumbnailUrls(hit: ScrapingdogResultPayload) {
    const all: string[] = []
    const push = (list: ScrapingdogResponse['lens_results'] | ScrapingdogResponse['exact_matches'] | ScrapingdogResponse['visual_matches']) => {
        if (!Array.isArray(list)) return
        for (const item of list) {
            const url = typeof item?.thumbnail === 'string' ? item.thumbnail : ''
            if (!url) continue
            if (!isStorageLikeUrl(url)) continue
            all.push(url)
        }
    }
    push(hit.exact_matches)
    push(hit.lens_results)
    push(hit.visual_matches)
    return all
}

function isStorageLikeUrl(url: string) {
    if (!/^https?:\/\//i.test(url)) return false
    return url.includes('/chatluna-storage/') || url.includes('/chatluna_storage/')
}

async function checkUrlAlive(url: string, timeoutSeconds: number) {
    const timeout = Math.max(5, timeoutSeconds)

    try {
        const head = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(timeout * 1000)
        })
        if (head.ok) return true
        if (head.status === 404 || head.status === 410) return false
    } catch {
        // ignore and fallback to GET
    }

    try {
        const get = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(timeout * 1000),
            headers: {
                range: 'bytes=0-0'
            }
        })
        if (get.ok) return true
        if (get.status === 404 || get.status === 410) return false
        return false
    } catch {
        return false
    }
}

function shouldCacheResult(result: OutputPayload) {
    if (result.provider === 'google') {
        const web = result.webDetection
        return !!(
            web.pagesWithMatchingImages?.length
            || web.webEntities?.length
            || web.bestGuessLabels?.length
        )
    }

    const lensRaw = (result as { lens_results?: unknown }).lens_results
    if (Array.isArray(lensRaw) && lensRaw.length === 1 && typeof lensRaw[0] === 'string') {
        const msg = lensRaw[0].toLowerCase()
        if (msg.includes("didn't return any results") || msg.includes('no results')) {
            return false
        }
    }

    const exact = (result as { exact_matches?: unknown[] }).exact_matches
    const lens = Array.isArray(lensRaw) ? lensRaw : []
    const visual = (result as { visual_matches?: unknown[] }).visual_matches

    return !!(
        (Array.isArray(exact) && exact.length)
        || lens.length
        || (Array.isArray(visual) && visual.length)
    )
}

function attachNote(result: OutputPayload, cfg: Config) {

    const notes = [
        'If you have the `read_files` tool, you can try using it to read media content.'
    ]
    if (cfg.customPrompt.trim()) {
        notes.push(cfg.customPrompt.trim())
    }

    return {
        ...result,
        note: notes.join('\n\n')
    }
}

export function apply(ctx: Context, cfg: Config) {
    const log = ctx.logger(name)
    cfg.serverPath = trimTrailingSlash((cfg.serverPath || '').trim())
    ;(ctx.model as any).extend(
        CACHE_TABLE,
        {
            key: 'string',
            payload: 'json',
            createdAt: 'timestamp',
            expiresAt: 'timestamp'
        },
        {
            primary: 'key',
            indexes: ['expiresAt']
        }
    )
    const cache = new ReverseImageCacheService(ctx, cfg)

    ctx.on('ready', async () => {
        await cache.init()
        if (!cfg.tool.enabled) {
            return
        }
        if (!cfg.apiKey.trim()) {
            log.warn('未配置 %s 服务提供商的 API Key，跳过注册 ChatLuna 工具。', cfg.provider)
            return
        }

        const toolName = (cfg.tool.name || 'google_reverse_image_search').trim() || 'google_reverse_image_search'
        ctx.effect(() => ctx.chatluna.platform.registerTool(toolName, {
            selector() {
                return true
            },
            createTool() {
                return new GoogleReverseImageTool(ctx, cfg, cache)
            }
        }))
    })
}

export * from './config'
