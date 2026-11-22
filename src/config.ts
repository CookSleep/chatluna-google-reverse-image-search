import { Schema } from '@chatluna/schema'

export interface Config {
    provider: 'scrapingdog' | 'google'
    apiKey: string
    serverPath: string
    timeoutSeconds: number
    maxResults: number
    customPrompt: string
    debug: boolean
    proxyMode: 'system' | 'off' | 'on'
    proxyAddress?: string
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
                .default('根据当前对话的图片 ref 或公网图片 URL 搜索图片出处，返回匹配网页。')
                .description('工具描述')
        }).description('工具设置')
    }),
    Schema.object({
        provider: Schema.union([
            Schema.const('scrapingdog').description('Scrapingdog'),
            Schema.const('google').description('Google')
        ]).default('scrapingdog').description('服务提供商'),
        apiKey: Schema.string().role('secret').default('').description('所选服务提供商的 API Key'),
        serverPath: Schema.string()
            .default('')
            .description('实例对外提供 /files/ 的公网地址，供 Scrapingdog 读取聊天附件'),
        timeoutSeconds: Schema.number().default(90).min(5).max(120).description('网络请求超时（秒）'),
        maxResults: Schema.number().default(10).min(1).max(50).description('最大返回结果数'),
        customPrompt: Schema.string()
            .role('textarea')
            .default(`以下网站更可能是作者发布原图/包含指向原帖的链接的地方（按优先级从上至下排序）：
x.com
e621.net
danbooru.donmai.us
各种rule34
furaffinity.net
bsky.app
pixiv.net
reddit.com

给出包含匹配图片的网页链接时，请只给出以上网站的链接（例外：要查找的图并不是网络画作，只是一般的图片）
- 若同时存在多个指向具体帖子（有完整路径而不是仅个人主页等）的链接，请只给出优先级最高的链接
- 若最终你找到的链接是e621、Danbooru、Reddit等非作者发布原图的平台，则使用网页读取工具查看其内容寻找其中可能包含的原帖链接
- 若是X上的转帖，只要包含完整路径，也可以算作原帖链接
- 若不存在以上网站的结果，则告知无法找到，不要再进行任何尝试了

请勿尝试使用其他工具查询图像来源！`)
            .description('将你自己的以图搜图经验或输出要求告知模型，如：在哪些网页更加可能找到原图、以什么格式给出包含匹配图片的网页链接（随工具结果返回）'),
        debug: Schema.boolean().default(false).description('输出调试日志')
    }).description('基础设置'),
    Schema.intersect([
        Schema.object({
            proxyMode: Schema.union([
                Schema.const('system').description('遵循实例 HTTP 服务的代理设置'),
                Schema.const('off').description('禁用代理'),
                Schema.const('on').description('使用自定义代理设置')
            ]).default('system').description('代理模式')
        }),
        Schema.union([
            Schema.object({
                proxyMode: Schema.const('on').required(),
                proxyAddress: Schema.string().default('http://127.0.0.1:7897').description('自定义代理地址')
            }),
            Schema.object({
                proxyMode: Schema.const('off').required()
            }),
            Schema.object({
                proxyMode: Schema.const('system')
            })
        ])
    ]),
    Schema.object({
        cacheService: Schema.object({
            enable: Schema.boolean().default(true).description('启用同 URL 结果缓存'),
            ttlSeconds: Schema.number().default(24 * 60 * 60).min(60).description('缓存有效期（秒）'),
            cleanupIntervalSeconds: Schema.number().default(10 * 60).min(60).description('过期缓存清理间隔（秒）'),
            cacheThumbnails: Schema.boolean()
                .default(true)
                .description('将 Scrapingdog 返回的内联缩略图保存到 V2 文件存储')
        }).description('缓存设置')
    })
])

export const name = 'chatluna-google-reverse-image-search'

export const usage = `## 以图搜图
输入当前对话的图片 ref 或公网图片 URL。Scrapingdog 读取聊天附件时需要配置实例公网地址，Google Cloud Vision 可直接接收图片内容。

### 获取 Scrapingdog API Key
1. 注册 [**Scrapingdog**](https://api.scrapingdog.com) 账户。
2. 在[**控制台**](https://api.scrapingdog.com)点击“YOUR API KEY”中的“Copy”按钮，复制 API Key。
3. 将 API Key 填入本插件，重载配置以应用。

### 获取 Google Cloud Vision API Key
1. 注册 [**Google Cloud**](https://console.cloud.google.com) 账户并创建结算账户（需要 VISA/Mastercard 信用卡）。
2. 在[**API 和服务**](https://console.cloud.google.com/apis/dashboard)页面点击“启用 API 和服务”，搜索并选择“Cloud Vision API”，进入详情页面启用它。
3. 在[**凭据**](https://console.cloud.google.com/apis/credentials)页面点击“创建凭据”，选择“API 密钥”，填写一个合适的名称，在“API 限制”中搜索并选择“Cloud Vision API”，点击“创建”。
4. 复制 API Key 并填入本插件，重载配置以应用。`
