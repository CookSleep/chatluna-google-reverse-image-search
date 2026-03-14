import { Schema } from 'koishi'

export interface Config {
    provider: 'scrapingdog' | 'google'
    apiKey: string
    serverPath: string
    timeoutSeconds: number
    maxResults: number
    customPrompt: string
    debug: boolean
    cacheService: {
        enable: boolean
        ttlSeconds: number
        cleanupIntervalSeconds: number
        cacheThumbnails: boolean
    }
    tool: {
        enabled: boolean
        name: string
        description: string
    }
}

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        tool: Schema.object({
            enabled: Schema.boolean().default(true).description('开启后自动注册 ChatLuna 工具'),
            name: Schema.string().default('google_reverse_image_search').description('工具名称'),
            description: Schema.string()
                .default('使用 Google Lens 进行以图搜图，输入图像 URL，返回包含匹配图片的网页链接')
                .description('工具描述')
        }).description('工具设置')
    }),
    Schema.object({
        provider: Schema.union([
            Schema.const('scrapingdog').description('Scrapingdog'),
            Schema.const('google').description('Google')
        ]).default('scrapingdog').description('服务提供商'),
        apiKey: Schema.string().default('').description('所选服务提供商的 API Key'),
        serverPath: Schema.string()
            .default('')
            .description('Koishi 在公网中的地址，用于替换查询中 chatluna-storage-service 的内网 `serverPath` 地址，使得 Google Lens 可以访问、将其用于查询；若 chatluna-storage-service 中填写的 `serverPath` 就是公网地址，请留空此处'),
        timeoutSeconds: Schema.number().default(20).min(5).max(120).description('网络请求超时（秒）'),
        maxResults: Schema.number().default(10).min(1).max(50).description('最大返回结果数'),
        customPrompt: Schema.string()
            .role('textarea')
            .default(`以下网站更可能是作者发布原图/包含指向原帖的链接的地方（按优先级从上至下排序）：
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

请勿尝试使用其他工具查询图像来源！`)
            .description('将你自己的以图搜图经验或输出要求告知模型，如：在哪些网页更加可能找到原图、以什么格式给出包含匹配图片的网页链接（在此处填写的提示词将会附加在正常的工具响应中以指导模型）'),
        debug: Schema.boolean().default(false).description('输出调试日志')
    }).description('基础设置'),
    Schema.object({
        cacheService: Schema.object({
            enable: Schema.boolean().default(true).description('启用同 URL 结果缓存'),
            ttlSeconds: Schema.number().default(24 * 60 * 60).min(60).description('缓存有效期（秒）'),
            cleanupIntervalSeconds: Schema.number().default(10 * 60).min(60).description('过期缓存清理间隔（秒）'),
            cacheThumbnails: Schema.boolean()
                .default(true)
                .description('缓存 Scrapingdog 返回的缩略图到 chatluna-storage-service，以便模型可以读取（需要安装并启用 `koishi-plugin-chatluna-storage-service`）')
        }).description('缓存设置')
    })
])

export const name = 'chatluna-google-reverse-image-search'

export const usage = `## chatluna-google-reverse-image-search
为 ChatLuna 提供 Google Reverse Image Search（Google Lens 以图搜图）工具，支持 Scrapingdog Google Lens API 与 Google Cloud Vision Detecting Web API。

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
4. 复制并将 API Key 填入本插件中，重载配置以应用。`

export const inject = {
    required: ['chatluna', 'database'],
    optional: ['chatluna_storage']
}
