var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// src/config.ts
import { Schema } from "koishi";
var Config = Schema.intersect([
  Schema.object({
    tool: Schema.object({
      enabled: Schema.boolean().default(true).description("开启后自动注册 ChatLuna 工具"),
      name: Schema.string().default("google_reverse_image_search").description("工具名称"),
      description: Schema.string().default("使用 Google Lens 进行以图搜图，输入图像 URL，返回包含匹配图片的网页链接").description("工具描述")
    }).description("工具设置")
  }),
  Schema.object({
    provider: Schema.union([
      Schema.const("scrapingdog").description("Scrapingdog"),
      Schema.const("google").description("Google")
    ]).default("scrapingdog").description("服务提供商"),
    apiKey: Schema.string().default("").description("所选服务提供商的 API Key"),
    serverPath: Schema.string().default("").description("Koishi 在公网中的地址，用于替换查询中 chatluna-storage-service 的内网 `serverPath` 地址，使得 Google Lens 可以访问、将其用于查询；若 chatluna-storage-service 中填写的 `serverPath` 就是公网地址，请留空此处"),
    timeoutSeconds: Schema.number().default(20).min(5).max(120).description("网络请求超时（秒）"),
    maxResults: Schema.number().default(10).min(1).max(50).description("最大返回结果数"),
    customPrompt: Schema.string().role("textarea").default(`以下网站更可能是作者发布原图/包含指向原帖的链接的地方（按优先级从上至下排序）：
x.com
danbooru.donmai.us
各种rule34
bsky.app
pixiv.net
reddit.com

给出包含匹配图片的网页链接时，请只给出以上网站的链接（例外：要查找的图并不是网络画作，只是一般的图片）
- 若同时存在多个指向具体帖子（有完整路径而不是仅个人主页等）的链接，请只给出优先级最高的链接
- 若最终你找到的链接是Danbooru、Reddit等非作者发布原图的平台，则使用可以读取网页内容的工具查看其内容寻找其中可能包含的原帖链接
- 若不存在以上网站的结果，则告知无法找到，不要再进行任何尝试了

请勿尝试使用其他工具查询图像来源！`).description("将你自己的以图搜图经验或输出要求告知模型，如：在哪些网页更加可能找到原图、以什么格式给出包含匹配图片的网页链接（在此处填写的提示词将会附加在正常的工具响应中以指导模型）"),
    debug: Schema.boolean().default(false).description("输出调试日志")
  }).description("基础设置"),
  Schema.object({
    cacheService: Schema.object({
      enable: Schema.boolean().default(true).description("启用同 URL 结果缓存"),
      ttlSeconds: Schema.number().default(24 * 60 * 60).min(60).description("缓存有效期（秒）"),
      cleanupIntervalSeconds: Schema.number().default(10 * 60).min(60).description("过期缓存清理间隔（秒）"),
      cacheThumbnails: Schema.boolean().default(true).description("缓存 Scrapingdog 返回的缩略图到 chatluna-storage-service，以便模型可以读取（需要安装并启用 `koishi-plugin-chatluna-storage-service`）")
    }).description("缓存设置")
  })
]);
var name = "chatluna-google-reverse-image-search";
var usage = `## chatluna-google-reverse-image-search
为 ChatLuna 提供 Google Reverse Image Search（以图搜图）工具，支持 Scrapingdog 与 Google 两种服务提供商。

### 效果
- Scrapingdog 的 Google Lens API 作为爬虫，效果与 Google Lens 几乎完全一致，并且提供免费试用积分，充值方式也更友好。
- Google 的 Detecting Web API 的效果比 Google Lens 差一些。

### 特性
- Scrapingdog 需要在请求中使用公网、可被 Google Lens 访问的图片 URL，若 URL 无法被 Google Lens 访问，则无法进行查询。
- Google 可在请求中包含已转为 Base64 编码的图片，没有这个问题。

### 价格

#### Scrapingdog
- 注册后赠送 30 天免费体验套餐，期间包含等价于 200 次 Google Lens API 请求的免费积分。
- 按需计费充值：$10 可购买等价于 5000 次 Google Lens API 请求的积分。
- 订阅制套餐：见[**官方网站**](https://api.scrapingdog.com/billing)。

以上数据仅供参考，可能不是最新版本，请以官网为准。

#### Google
- 前 1000 次/月：免费
- 第 1001~5,000,000 次/月：$0.0035/次
- 5,000,001 次以上/月：需要联系 Google 报价

以上数据仅供参考，可能不是最新版本，请以[**官方文档**](https://cloud.google.com/vision/pricing)为准。

### 获取 API Key

#### 获取 Scrapingdog 的 API Key
1. 注册 [**Scrapingdog**](https://api.scrapingdog.com) 账户。
2. 在 [**此处**](https://api.scrapingdog.com) 点击 **YOUR API KEY** 中的 **Copy** 按钮，复制 API Key。
3. 将 API Key 填入本插件中，重载配置以应用。

#### 获取 Google Detecting Web API 的 API Key
1. 注册 [**Google Cloud**](https://console.cloud.google.com) 账户并创建结算账户（需要 VISA/Mastercard 信用卡）。
2. 在 [**此处**](https://console.cloud.google.com/apis/dashboard) 点击 **启用 API 和服务**，搜索并选择 **Cloud Vision API**，进入详情页面启用它。
3. 在 [**此处**](https://console.cloud.google.com/apis/credentials) 点击 **创建凭证**，选择 **API 密钥**，填写一个合适的名称，在 **API 限制** 中搜索并选择 **Cloud Vision API**，点击 **创建**。
4. 复制并将 API Key 填入本插件中，重载配置以应用。`;
var inject = {
  required: ["chatluna", "database"],
  optional: ["chatluna_storage"]
};

// src/index.ts
var CACHE_TABLE = "chatluna_google_reverse_image_cache";
var ReverseImageCacheService = class {
  constructor(ctx, cfg) {
    this.ctx = ctx;
    this.cfg = cfg;
  }
  static {
    __name(this, "ReverseImageCacheService");
  }
  initialized = false;
  cleanupRunning = false;
  lastCleanupAt = 0;
  async init() {
    this.initialized = true;
    await this.cleanupExpired();
  }
  async ensureReady() {
    if (this.initialized) return;
    await this.init();
  }
  async get(key) {
    if (!this.cfg.cacheService.enable) return null;
    await this.ensureReady();
    await this.maybeCleanup();
    const db = this.ctx.database;
    const rows = await db.get(
      CACHE_TABLE,
      { key },
      ["key", "payload", "expiresAt"]
    );
    const row = rows[0];
    if (!row) return null;
    const expiresAtMs = Date.parse(String(row.expiresAt));
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      await db.remove(CACHE_TABLE, { key });
      return null;
    }
    return row.payload;
  }
  async set(key, payload) {
    if (!this.cfg.cacheService.enable) return;
    await this.ensureReady();
    await this.maybeCleanup();
    const now = /* @__PURE__ */ new Date();
    const expiresAt = new Date(
      now.getTime() + this.cfg.cacheService.ttlSeconds * 1e3
    );
    const db = this.ctx.database;
    await db.upsert(
      CACHE_TABLE,
      [{
        key,
        payload,
        createdAt: now,
        expiresAt
      }],
      ["key"]
    );
  }
  async maybeCleanup() {
    const now = Date.now();
    if (now - this.lastCleanupAt < this.cfg.cacheService.cleanupIntervalSeconds * 1e3) {
      return;
    }
    this.lastCleanupAt = now;
    await this.cleanupExpired();
  }
  async cleanupExpired() {
    if (this.cleanupRunning) return;
    this.cleanupRunning = true;
    try {
      const db = this.ctx.database;
      await db.remove(CACHE_TABLE, {
        expiresAt: { $lte: /* @__PURE__ */ new Date() }
      });
    } finally {
      this.cleanupRunning = false;
    }
  }
};
var schema = z.object({
  imageUrl: z.string().url().describe("需要执行以图搜图的图像 URL。")
});
var GoogleReverseImageTool = class extends StructuredTool {
  constructor(ctx, cfg, cache) {
    super({});
    this.ctx = ctx;
    this.cfg = cfg;
    this.cache = cache;
    this.name = (cfg.tool.name || "google_reverse_image_search").trim();
    this.description = (cfg.tool.description || "").trim() || "使用 Google Detecting Web 进行以图搜图，输入图像 URL 并返回匹配线索。";
  }
  static {
    __name(this, "GoogleReverseImageTool");
  }
  name;
  description;
  schema = schema;
  async _call(input, _runManager, _runnable) {
    const log = this.ctx.logger(name);
    const url = input.imageUrl.trim();
    const scrapingdogImageUrl = this.cfg.provider === "scrapingdog" ? rewriteImageUrlForScrapingdog(this.ctx, this.cfg, url) : url;
    const key = `v1:${this.cfg.provider}:max=${this.cfg.maxResults}:serverPath=${trimTrailingSlash((this.cfg.serverPath || "").trim())}:${scrapingdogImageUrl}`;
    try {
      const hit = await this.cache.get(key);
      if (hit) {
        const shouldRefreshScrapingdog = await needRefreshScrapingdogCache(this.ctx, this.cfg, hit);
        if (shouldRefreshScrapingdog) {
          if (this.cfg.debug) {
            log.info("检测到 Scrapingdog 缩略图缓存失效，准备重新请求并覆盖缓存：%s", key);
          }
        } else {
          if (this.cfg.debug) {
            log.info("缓存命中：%s", key);
          }
          return JSON.stringify(attachNote(hit, this.cfg), null, 2);
        }
      }
      if (this.cfg.debug) {
        log.info("缓存未命中：%s", key);
      }
      let out;
      if (this.cfg.provider === "scrapingdog") {
        out = await callScrapingdog(this.ctx, url, this.cfg);
      } else {
        out = await callGoogleVision(url, this.cfg);
      }
      if (shouldCacheResult(out)) {
        await this.cache.set(key, out);
        if (this.cfg.debug) {
          log.info("缓存写入：%s", key);
        }
      } else if (this.cfg.debug) {
        log.info("检测到失败结果，跳过缓存写入：%s", key);
      }
      return JSON.stringify(attachNote(out, this.cfg), null, 2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (this.cfg.debug) {
        log.error(err);
      }
      return `以图搜图失败：${msg}`;
    }
  }
};
async function callGoogleVision(imageUrl, cfg) {
  const imgRes = await fetch(imageUrl, {
    method: "GET",
    signal: AbortSignal.timeout(cfg.timeoutSeconds * 1e3)
  });
  if (!imgRes.ok) {
    throw new Error(`获取图像失败：HTTP ${imgRes.status}`);
  }
  const bytes = Buffer.from(await imgRes.arrayBuffer());
  const base64Url = bytes.toString("base64");
  const apiRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(cfg.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
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
                type: "WEB_DETECTION"
              }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(cfg.timeoutSeconds * 1e3)
    }
  );
  const data = await apiRes.json();
  if (!apiRes.ok) {
    throw new Error(`Google Vision 请求失败：${data.error?.message || `HTTP ${apiRes.status}`}`);
  }
  const first = data.responses?.[0];
  if (first?.error?.message) {
    throw new Error(`Google Vision 返回错误：${first.error.message}`);
  }
  const web = first?.webDetection;
  if (!web) {
    throw new Error("Google Vision 没有返回可用的 webDetection 结果。");
  }
  const pages = (web.pagesWithMatchingImages || []).filter((item) => item.url).map((item) => ({
    url: item.url,
    pageTitle: item.pageTitle || ""
  }));
  return {
    provider: "google",
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
  };
}
__name(callGoogleVision, "callGoogleVision");
async function callScrapingdog(ctx, imageUrl, cfg) {
  const rewrittenImageUrl = rewriteImageUrlForScrapingdog(ctx, cfg, imageUrl);
  if (!isScrapingdogReachableUrl(rewrittenImageUrl)) {
    throw new Error("Scrapingdog 需要可被公网访问的图像 URL。当前 URL 很可能是内网地址（例如 localhost、127.0.0.1、koishi 容器域名或私网 IP），Scrapingdog 无法抓取。");
  }
  const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(rewrittenImageUrl)}`;
  const params = new URLSearchParams({
    api_key: cfg.apiKey,
    url: lensUrl,
    exact_matches: "true"
  });
  const apiRes = await fetch(
    `https://api.scrapingdog.com/google_lens?${params.toString()}`,
    {
      method: "GET",
      signal: AbortSignal.timeout(cfg.timeoutSeconds * 1e3)
    }
  );
  const data = await apiRes.json();
  if (!apiRes.ok) {
    throw new Error(`Scrapingdog 请求失败：${data.error || `HTTP ${apiRes.status}`}`);
  }
  const result = {
    ...data
  };
  delete result.related_searches;
  if (Array.isArray(result.exact_matches)) {
    result.exact_matches = result.exact_matches.slice(0, cfg.maxResults);
  }
  if (Array.isArray(result.lens_results)) {
    result.lens_results = result.lens_results.slice(0, cfg.maxResults);
  }
  if (Array.isArray(result.visual_matches)) {
    result.visual_matches = result.visual_matches.slice(0, cfg.maxResults);
  }
  stripScrapingdogExtraFields(result.exact_matches);
  stripScrapingdogExtraFields(result.lens_results);
  stripScrapingdogExtraFields(result.visual_matches);
  await cacheScrapingdogThumbnails(ctx, cfg, result);
  return {
    provider: "scrapingdog",
    imageUrl,
    ...result
  };
}
__name(callScrapingdog, "callScrapingdog");
async function cacheScrapingdogThumbnails(ctx, cfg, data) {
  if (!cfg.cacheService.cacheThumbnails) return;
  if (!hasStorageService(ctx)) return;
  await rewriteThumbnailList(ctx, cfg, data.exact_matches);
  await rewriteThumbnailList(ctx, cfg, data.lens_results);
  await rewriteThumbnailList(ctx, cfg, data.visual_matches);
}
__name(cacheScrapingdogThumbnails, "cacheScrapingdogThumbnails");
async function rewriteThumbnailList(ctx, cfg, list) {
  if (!Array.isArray(list) || !list.length) return;
  const ttlHours = Math.max(1, Math.ceil(cfg.cacheService.ttlSeconds / 3600));
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== "object") continue;
    const raw = typeof item.thumbnail === "string" ? item.thumbnail : "";
    if (!raw.startsWith("data:")) continue;
    try {
      const parsed = parseDataUrl(raw);
      if (!parsed) {
        delete item.thumbnail;
        continue;
      }
      const stored = await ctx.chatluna_storage.createTempFile(
        parsed.buffer,
        `scrapingdog-thumb-${i + 1}${parsed.ext}`,
        ttlHours
      );
      item.thumbnail = stored.url;
    } catch {
      delete item.thumbnail;
    }
  }
}
__name(rewriteThumbnailList, "rewriteThumbnailList");
function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/i);
  if (!match?.[2]) return null;
  try {
    const mime = (match[1] || "").toLowerCase();
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length) return null;
    return {
      buffer,
      ext: mimeToExt(mime)
    };
  } catch {
    return null;
  }
}
__name(parseDataUrl, "parseDataUrl");
function mimeToExt(mime) {
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  return ".jpg";
}
__name(mimeToExt, "mimeToExt");
function hasStorageService(ctx) {
  return typeof ctx.chatluna_storage?.createTempFile === "function";
}
__name(hasStorageService, "hasStorageService");
function rewriteImageUrlForScrapingdog(ctx, cfg, imageUrl) {
  const publicServerPath = (cfg.serverPath || "").trim();
  if (!publicServerPath) return imageUrl;
  const storageServerPath = (ctx.chatluna_storage?.config?.serverPath || "").trim();
  if (!storageServerPath) return imageUrl;
  const normalizedStorage = trimTrailingSlash(storageServerPath);
  const normalizedPublic = trimTrailingSlash(publicServerPath);
  if (!normalizedStorage || !normalizedPublic) return imageUrl;
  if (!imageUrl.startsWith(normalizedStorage)) return imageUrl;
  return `${normalizedPublic}${imageUrl.slice(normalizedStorage.length)}`;
}
__name(rewriteImageUrlForScrapingdog, "rewriteImageUrlForScrapingdog");
function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
__name(trimTrailingSlash, "trimTrailingSlash");
function isScrapingdogReachableUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (!host) return false;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0" || host === "koishi" || host.endsWith(".local") || !host.includes(".")) {
      return false;
    }
    if (isPrivateIPv4(host)) return false;
    return true;
  } catch {
    return false;
  }
}
__name(isScrapingdogReachableUrl, "isScrapingdogReachableUrl");
function isPrivateIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}
__name(isPrivateIPv4, "isPrivateIPv4");
function stripScrapingdogExtraFields(list) {
  if (!Array.isArray(list)) return;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    delete item.price;
    delete item.in_stock;
  }
}
__name(stripScrapingdogExtraFields, "stripScrapingdogExtraFields");
async function needRefreshScrapingdogCache(ctx, cfg, hit) {
  if (hit.provider !== "scrapingdog") return false;
  if (!cfg.cacheService.cacheThumbnails) return false;
  const urls = collectStorageThumbnailUrls(hit);
  if (!urls.length) return false;
  for (const url of urls) {
    const ok = await checkUrlAlive(url, cfg.timeoutSeconds);
    if (!ok) {
      return true;
    }
  }
  return false;
}
__name(needRefreshScrapingdogCache, "needRefreshScrapingdogCache");
function collectStorageThumbnailUrls(hit) {
  const all = [];
  const push = /* @__PURE__ */ __name((list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const url = typeof item?.thumbnail === "string" ? item.thumbnail : "";
      if (!url) continue;
      if (!isStorageLikeUrl(url)) continue;
      all.push(url);
    }
  }, "push");
  push(hit.exact_matches);
  push(hit.lens_results);
  push(hit.visual_matches);
  return all;
}
__name(collectStorageThumbnailUrls, "collectStorageThumbnailUrls");
function isStorageLikeUrl(url) {
  if (!/^https?:\/\//i.test(url)) return false;
  return url.includes("/chatluna-storage/") || url.includes("/chatluna_storage/");
}
__name(isStorageLikeUrl, "isStorageLikeUrl");
async function checkUrlAlive(url, timeoutSeconds) {
  const timeout = Math.max(5, timeoutSeconds);
  try {
    const head = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeout * 1e3)
    });
    if (head.ok) return true;
    if (head.status === 404 || head.status === 410) return false;
  } catch {
  }
  try {
    const get = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(timeout * 1e3),
      headers: {
        range: "bytes=0-0"
      }
    });
    if (get.ok) return true;
    if (get.status === 404 || get.status === 410) return false;
    return false;
  } catch {
    return false;
  }
}
__name(checkUrlAlive, "checkUrlAlive");
function shouldCacheResult(result) {
  if (result.provider === "google") {
    const web = result.webDetection;
    return !!(web.pagesWithMatchingImages?.length || web.webEntities?.length || web.bestGuessLabels?.length);
  }
  const lensRaw = result.lens_results;
  if (Array.isArray(lensRaw) && lensRaw.length === 1 && typeof lensRaw[0] === "string") {
    const msg = lensRaw[0].toLowerCase();
    if (msg.includes("didn't return any results") || msg.includes("no results")) {
      return false;
    }
  }
  const exact = result.exact_matches;
  const lens = Array.isArray(lensRaw) ? lensRaw : [];
  const visual = result.visual_matches;
  return !!(Array.isArray(exact) && exact.length || lens.length || Array.isArray(visual) && visual.length);
}
__name(shouldCacheResult, "shouldCacheResult");
function attachNote(result, cfg) {
  const notes = [
    "If you have the `read_files` tool, you can try using it to read media content."
  ];
  if (cfg.customPrompt.trim()) {
    notes.push(cfg.customPrompt.trim());
  }
  return {
    ...result,
    note: notes.join("\n\n")
  };
}
__name(attachNote, "attachNote");
function apply(ctx, cfg) {
  const log = ctx.logger(name);
  cfg.serverPath = trimTrailingSlash((cfg.serverPath || "").trim());
  ctx.model.extend(
    CACHE_TABLE,
    {
      key: "string",
      payload: "json",
      createdAt: "timestamp",
      expiresAt: "timestamp"
    },
    {
      primary: "key",
      indexes: ["expiresAt"]
    }
  );
  const cache = new ReverseImageCacheService(ctx, cfg);
  ctx.on("ready", async () => {
    await cache.init();
    if (!cfg.tool.enabled) {
      return;
    }
    if (!cfg.apiKey.trim()) {
      log.warn("未配置 %s 服务提供商的 API Key，跳过注册 ChatLuna 工具。", cfg.provider);
      return;
    }
    const toolName = (cfg.tool.name || "google_reverse_image_search").trim() || "google_reverse_image_search";
    ctx.effect(() => ctx.chatluna.platform.registerTool(toolName, {
      selector() {
        return true;
      },
      createTool() {
        return new GoogleReverseImageTool(ctx, cfg, cache);
      }
    }));
  });
}
__name(apply, "apply");
export {
  Config,
  apply,
  inject,
  name,
  usage
};
