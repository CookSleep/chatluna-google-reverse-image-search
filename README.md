# ChatLuna Google Reverse Image Search

![npm](https://img.shields.io/npm/v/koishi-plugin-chatluna-google-reverse-image-search) ![License](https://img.shields.io/badge/license-GPLv3-brightgreen)

为 ChatLuna 提供以图搜图工具，支持 Scrapingdog Google Lens API 与 Google Cloud Vision Detecting Web API。

## ✨ 功能特性

### 1. 🔎 双服务提供商
- **Scrapingdog（默认）**：Google Lens API（Google Lens 爬虫）
- **Google**：Google Cloud Vision Detecting Web API

### 2. 🧠 结构化结果输出
- **Scrapingdog**：移除 `related_searches`、`price`、`in_stock` 字段。
- **Google**：只保留 `pagesWithMatchingImages` 的 URL 结果，`webEntities` 去除 `entityId`。

### 3. ⚡ 缓存与一致性
- **同 URL 缓存**：查询结果缓存到数据库，支持 TTL 与清理间隔配置。
- **失败不缓存**：失败结果不写入缓存，避免污染后续请求。
- **缩略图失效自动刷新**：若检测到缓存中的存储缩略图失效，会重新请求并覆盖旧缓存结果。

### 4. 🖼️ 缩略图可读化
- 支持将 Scrapingdog 返回的 Base64 缩略图写入 `chatluna-storage-service`，替换为可访问 URL，方便模型配合 `read_files` 读取。
- 若转存失败，会直接删除该条目的 `thumbnail` 字段。

## ⚙️ 主要配置

- `tool.*`：工具开关、名称、描述。
- `provider`：服务提供商，`scrapingdog` 或 `google`（默认 `scrapingdog`）。
- `apiKey`：所选服务提供商 API Key。
- `serverPath`：Koishi 公网地址。用于将查询中 `chatluna-storage-service` 的内网 `serverPath` 替换成公网地址（若 storage-service 已配置公网地址，请留空）。
- `timeoutSeconds`：请求超时（秒）。
- `maxResults`：最大返回结果数。
- `customPrompt`：附加到工具结果 `note` 的自定义提示词。
- `cacheService.*`：缓存开关、TTL、清理间隔、缩略图转存开关。

## ✅ 使用前置条件

- 必需：`koishi-plugin-chatluna`、数据库服务。
- 可选：`koishi-plugin-chatluna-storage-service`（建议启用，用于 Scrapingdog 缩略图转存与读取）。
- 若使用 Scrapingdog，请确保传入图像 URL 可被公网访问；内网地址（如 `localhost`、`127.0.0.1`、`koishi`、私网 IP）无法被 Scrapingdog 抓取。

## 🛡️ 使用声明

- 本项目仅供学习、研究与合规开发使用。
- 使用者应自行遵守目标平台与第三方服务（Google、Scrapingdog）的服务条款与法律法规。
- 请勿将本插件用于任何违法、违规、侵犯版权或违反平台规则的行为，因不当使用产生的后果由使用者自行承担。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进代码。
