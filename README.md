<div align="center">

# ChatLuna Google Reverse Image Search

[![npm](https://img.shields.io/npm/v/koishi-plugin-chatluna-google-reverse-image-search?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-chatluna-google-reverse-image-search)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

**让 ChatLuna 用 Google Lens 找图片出处**

为 [ChatLuna](https://github.com/ChatLunaLab/chatluna) 提供以图搜图工具：传入图片 URL，返回包含匹配图片的网页链接。<br>
可选 [Scrapingdog](https://www.scrapingdog.com/) 的 Google Lens API，或 Google Cloud Vision 的 Web Detection。

</div>

---

## ✨ 功能

### 🔎 两种搜索服务
- **Scrapingdog（默认）**：抓取 Google Lens 的结果，效果与 Google Lens 几乎一致；图片 URL 必须能被公网访问。
- **Google Cloud Vision**：插件先下载图片，再以 Base64 提交，不要求图片能被公网访问，效果比 Google Lens 差一些。

### 🧠 精简的结果
- **Scrapingdog**：去掉 `related_searches`、`price`、`in_stock` 等与找出处无关的字段。
- **Google**：只保留 `pagesWithMatchingImages` 的网页链接，`webEntities` 去掉 `entityId`。
- **结果数**：默认最多 10 条，最多 50 条。

### 🗺️ 引导模型找原帖
- **自定义提示词**：搜索后把提示词作为附加的用户消息注入上下文。默认提示词列出更可能是作者原帖的网站（X、e621、Danbooru、Pixiv 等）及取舍规则，可以换成你自己的经验。
- **配合网页读取**：与 [chatluna-llm-web-search](https://github.com/CookSleep/chatluna-llm-web-search) 搭配时，模型可以进一步读取结果页面，寻找原帖链接。

### 🖼️ 缩略图与内网图片
- **缩略图转存**：把 Scrapingdog 返回的 Base64 缩略图存入 `chatluna-storage-service`，换成可访问的 URL，方便模型用 `read_files` 查看；转存失败时删去该条的缩略图。
- **内网地址替换**：图片来自 `chatluna-storage-service` 且其地址是内网地址时，用你填写的 Koishi 公网地址替换，让 Scrapingdog 能抓取。

### ⚡ 缓存
- **同 URL 缓存**：结果存入数据库，默认保存 1 天，每 10 分钟清理过期记录。
- **失败不缓存**：失败的结果不写入缓存。
- **缩略图失效自动刷新**：缓存中的缩略图链接失效时重新查询并覆盖。

---

## ✅ 前置条件

- Koishi，以及已安装并配置好模型的 [ChatLuna](https://github.com/ChatLunaLab/chatluna)（`koishi-plugin-chatluna` 1.3.36 及以上）。
- 需要 `database` 服务。
- 所选服务提供商的 API Key。未填写时插件不会注册工具。
- 可选：[`koishi-plugin-chatluna-storage-service`](https://www.npmjs.com/package/koishi-plugin-chatluna-storage-service)，用于转存缩略图。
- 可选：[`koishi-plugin-chatluna-llm-web-search`](https://www.npmjs.com/package/koishi-plugin-chatluna-llm-web-search)，提供网页读取工具。
- 使用 Scrapingdog 时，图片 URL 必须能被公网访问；`localhost`、`127.0.0.1`、`koishi` 容器域名和私网 IP 都无法被抓取。

## 📦 安装

在 Koishi 控制台的插件市场中搜索 `chatluna-google-reverse-image-search` 安装，或在 Koishi 项目目录中运行：

```bash
npm install koishi-plugin-chatluna-google-reverse-image-search
```

## 🔑 获取 API Key

**Scrapingdog**

1. 注册 [Scrapingdog](https://api.scrapingdog.com) 账户。注册后赠送 30 天免费体验套餐，含相当于 200 次 Google Lens API 请求的积分；之后按需充值，$10 可购买相当于 5000 次请求的积分。价格以[官网](https://api.scrapingdog.com/billing)为准。
2. 在控制台首页的 **YOUR API KEY** 中点击 **Copy**，复制 API Key。
3. 填入插件配置，重载配置。

**Google Cloud Vision**

1. 注册 [Google Cloud](https://console.cloud.google.com) 账户并创建结算账户（需要 VISA / Mastercard 信用卡）。每月前 1000 次免费，价格见[官方文档](https://cloud.google.com/vision/pricing)。
2. 在 [API 和服务](https://console.cloud.google.com/apis/dashboard) 中点击「启用 API 和服务」，搜索并启用 **Cloud Vision API**。
3. 在[凭据](https://console.cloud.google.com/apis/credentials)页面点击「创建凭据 → API 密钥」，在「API 限制」中选择 **Cloud Vision API**，点击「创建」。
4. 复制 API Key 填入插件配置，重载配置。

## ⚙️ 配置

| 配置项 | 说明 |
| --- | --- |
| `tool` | 是否注册工具、工具名（默认 `google_reverse_image_search`）、工具描述。 |
| `provider` | 服务提供商：`scrapingdog`（默认）或 `google`。 |
| `apiKey` | 所选服务提供商的 API Key。 |
| `serverPath` | Koishi 的公网地址，用于替换 `chatluna-storage-service` 的内网地址；`chatluna-storage-service` 中填的已是公网地址时留空。 |
| `timeoutSeconds` | 网络请求超时，默认 20 秒。 |
| `maxResults` | 最大返回结果数，默认 10。 |
| `customPrompt` | 搜索后注入上下文的提示词。 |
| `proxyMode` | 代理：沿用 ChatLuna 的全局代理（默认）、禁用，或使用 `proxyAddress` 指定的代理。 |
| `cacheService` | 缓存开关、有效期、清理间隔、是否转存缩略图。 |
| `debug` | 输出调试日志。 |

## ⚠️ 使用声明

- 本项目仅供学习、研究与合规开发使用。
- 使用者应自行遵守目标平台与第三方服务（Google、Scrapingdog）的服务条款与法律法规。
- 请勿将本插件用于任何违法、违规、侵犯版权或违反平台规则的行为，因不当使用产生的后果由使用者自行承担。

## 📄 许可

本项目基于 [GPL-3.0](LICENSE) 开源。

## 🙏 致谢

- [ChatLuna](https://github.com/ChatLunaLab/chatluna)：插件所扩展的 Koishi 大模型对话框架。
- [Koishi](https://koishi.chat/)：机器人框架。
- [Scrapingdog](https://www.scrapingdog.com/) 与 [Google Cloud Vision](https://cloud.google.com/vision)：提供以图搜图的接口。
