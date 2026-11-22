import { Schema } from '@chatluna/schema';
export interface Config {
    provider: 'scrapingdog' | 'google';
    apiKey: string;
    serverPath: string;
    timeoutSeconds: number;
    maxResults: number;
    customPrompt: string;
    debug: boolean;
    proxyMode: 'system' | 'off' | 'on';
    proxyAddress?: string;
    cacheService: {
        enable: boolean;
        ttlSeconds: number;
        cleanupIntervalSeconds: number;
        cacheThumbnails: boolean;
    };
    tool: {
        enabled: boolean;
        name: string;
        description: string;
    };
}
export declare const Config: Schema<Config>;
export declare const name = "chatluna-google-reverse-image-search";
export declare const usage = "## \u4EE5\u56FE\u641C\u56FE\n\u8F93\u5165\u5F53\u524D\u5BF9\u8BDD\u7684\u56FE\u7247 ref \u6216\u516C\u7F51\u56FE\u7247 URL\u3002Scrapingdog \u8BFB\u53D6\u804A\u5929\u9644\u4EF6\u65F6\u9700\u8981\u914D\u7F6E\u5B9E\u4F8B\u516C\u7F51\u5730\u5740\uFF0CGoogle Cloud Vision \u53EF\u76F4\u63A5\u63A5\u6536\u56FE\u7247\u5185\u5BB9\u3002\n\n### \u83B7\u53D6 Scrapingdog API Key\n1. \u6CE8\u518C [**Scrapingdog**](https://api.scrapingdog.com) \u8D26\u6237\u3002\n2. \u5728[**\u63A7\u5236\u53F0**](https://api.scrapingdog.com)\u70B9\u51FB\u201CYOUR API KEY\u201D\u4E2D\u7684\u201CCopy\u201D\u6309\u94AE\uFF0C\u590D\u5236 API Key\u3002\n3. \u5C06 API Key \u586B\u5165\u672C\u63D2\u4EF6\uFF0C\u91CD\u8F7D\u914D\u7F6E\u4EE5\u5E94\u7528\u3002\n\n### \u83B7\u53D6 Google Cloud Vision API Key\n1. \u6CE8\u518C [**Google Cloud**](https://console.cloud.google.com) \u8D26\u6237\u5E76\u521B\u5EFA\u7ED3\u7B97\u8D26\u6237\uFF08\u9700\u8981 VISA/Mastercard \u4FE1\u7528\u5361\uFF09\u3002\n2. \u5728[**API \u548C\u670D\u52A1**](https://console.cloud.google.com/apis/dashboard)\u9875\u9762\u70B9\u51FB\u201C\u542F\u7528 API \u548C\u670D\u52A1\u201D\uFF0C\u641C\u7D22\u5E76\u9009\u62E9\u201CCloud Vision API\u201D\uFF0C\u8FDB\u5165\u8BE6\u60C5\u9875\u9762\u542F\u7528\u5B83\u3002\n3. \u5728[**\u51ED\u636E**](https://console.cloud.google.com/apis/credentials)\u9875\u9762\u70B9\u51FB\u201C\u521B\u5EFA\u51ED\u636E\u201D\uFF0C\u9009\u62E9\u201CAPI \u5BC6\u94A5\u201D\uFF0C\u586B\u5199\u4E00\u4E2A\u5408\u9002\u7684\u540D\u79F0\uFF0C\u5728\u201CAPI \u9650\u5236\u201D\u4E2D\u641C\u7D22\u5E76\u9009\u62E9\u201CCloud Vision API\u201D\uFF0C\u70B9\u51FB\u201C\u521B\u5EFA\u201D\u3002\n4. \u590D\u5236 API Key \u5E76\u586B\u5165\u672C\u63D2\u4EF6\uFF0C\u91CD\u8F7D\u914D\u7F6E\u4EE5\u5E94\u7528\u3002";
