import { Schema } from 'koishi';
export interface Config {
    provider: 'scrapingdog' | 'google';
    apiKey: string;
    serverPath: string;
    timeoutSeconds: number;
    maxResults: number;
    customPrompt: string;
    debug: boolean;
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
export declare const usage = "## chatluna-google-reverse-image-search\n\u4E3A ChatLuna \u63D0\u4F9B Google Reverse Image Search\uFF08Google Lens \u4EE5\u56FE\u641C\u56FE\uFF09\u5DE5\u5177\uFF0C\u652F\u6301 Scrapingdog Google Lens API \u4E0E Google Cloud Vision Detecting Web API\u3002\n\n### \u6548\u679C\n- Scrapingdog \u7684 Google Lens API \u4F5C\u4E3A\u722C\u866B\uFF0C\u6548\u679C\u4E0E Google Lens \u51E0\u4E4E\u5B8C\u5168\u4E00\u81F4\uFF0C\u5E76\u4E14\u63D0\u4F9B\u514D\u8D39\u8BD5\u7528\u79EF\u5206\uFF0C\u5145\u503C\u65B9\u5F0F\u4E5F\u66F4\u53CB\u597D\u3002\n- Google \u7684 Detecting Web API \u7684\u6548\u679C\u6BD4 Google Lens \u5DEE\u4E00\u4E9B\u3002\n\n### \u7279\u6027\n- Scrapingdog \u9700\u8981\u5728\u8BF7\u6C42\u4E2D\u4F7F\u7528\u516C\u7F51\u3001\u53EF\u88AB Google Lens \u8BBF\u95EE\u7684\u56FE\u7247 URL\uFF0C\u82E5 URL \u65E0\u6CD5\u88AB Google Lens \u8BBF\u95EE\uFF0C\u5219\u65E0\u6CD5\u8FDB\u884C\u67E5\u8BE2\u3002\n- Google \u53EF\u5728\u8BF7\u6C42\u4E2D\u5305\u542B\u5DF2\u8F6C\u4E3A Base64 \u7F16\u7801\u7684\u56FE\u7247\uFF0C\u6CA1\u6709\u8FD9\u4E2A\u95EE\u9898\u3002\n\n### \u4EF7\u683C\n\n#### Scrapingdog\n- \u6CE8\u518C\u540E\u8D60\u9001 30 \u5929\u514D\u8D39\u4F53\u9A8C\u5957\u9910\uFF0C\u671F\u95F4\u5305\u542B\u7B49\u4EF7\u4E8E 200 \u6B21 Google Lens API \u8BF7\u6C42\u7684\u514D\u8D39\u79EF\u5206\u3002\n- \u6309\u9700\u8BA1\u8D39\u5145\u503C\uFF1A$10 \u53EF\u8D2D\u4E70\u7B49\u4EF7\u4E8E 5000 \u6B21 Google Lens API \u8BF7\u6C42\u7684\u79EF\u5206\u3002\n- \u8BA2\u9605\u5236\u5957\u9910\uFF1A\u89C1[**\u5B98\u65B9\u7F51\u7AD9**](https://api.scrapingdog.com/billing)\u3002\n\n\u4EE5\u4E0A\u6570\u636E\u4EC5\u4F9B\u53C2\u8003\uFF0C\u53EF\u80FD\u4E0D\u662F\u6700\u65B0\u7248\u672C\uFF0C\u8BF7\u4EE5\u5B98\u7F51\u4E3A\u51C6\u3002\n\n#### Google\n- \u524D 1000 \u6B21/\u6708\uFF1A\u514D\u8D39\n- \u7B2C 1001~5,000,000 \u6B21/\u6708\uFF1A$0.0035/\u6B21\n- 5,000,001 \u6B21\u4EE5\u4E0A/\u6708\uFF1A\u9700\u8981\u8054\u7CFB Google \u62A5\u4EF7\n\n\u4EE5\u4E0A\u6570\u636E\u4EC5\u4F9B\u53C2\u8003\uFF0C\u53EF\u80FD\u4E0D\u662F\u6700\u65B0\u7248\u672C\uFF0C\u8BF7\u4EE5[**\u5B98\u65B9\u6587\u6863**](https://cloud.google.com/vision/pricing)\u4E3A\u51C6\u3002\n\n### \u83B7\u53D6 API Key\n\n#### \u83B7\u53D6 Scrapingdog \u7684 API Key\n1. \u6CE8\u518C [**Scrapingdog**](https://api.scrapingdog.com) \u8D26\u6237\u3002\n2. \u5728 [**\u6B64\u5904**](https://api.scrapingdog.com) \u70B9\u51FB **YOUR API KEY** \u4E2D\u7684 **Copy** \u6309\u94AE\uFF0C\u590D\u5236 API Key\u3002\n3. \u5C06 API Key \u586B\u5165\u672C\u63D2\u4EF6\u4E2D\uFF0C\u91CD\u8F7D\u914D\u7F6E\u4EE5\u5E94\u7528\u3002\n\n#### \u83B7\u53D6 Google Detecting Web API \u7684 API Key\n1. \u6CE8\u518C [**Google Cloud**](https://console.cloud.google.com) \u8D26\u6237\u5E76\u521B\u5EFA\u7ED3\u7B97\u8D26\u6237\uFF08\u9700\u8981 VISA/Mastercard \u4FE1\u7528\u5361\uFF09\u3002\n2. \u5728 [**\u6B64\u5904**](https://console.cloud.google.com/apis/dashboard) \u70B9\u51FB **\u542F\u7528 API \u548C\u670D\u52A1**\uFF0C\u641C\u7D22\u5E76\u9009\u62E9 **Cloud Vision API**\uFF0C\u8FDB\u5165\u8BE6\u60C5\u9875\u9762\u542F\u7528\u5B83\u3002\n3. \u5728 [**\u6B64\u5904**](https://console.cloud.google.com/apis/credentials) \u70B9\u51FB **\u521B\u5EFA\u51ED\u8BC1**\uFF0C\u9009\u62E9 **API \u5BC6\u94A5**\uFF0C\u586B\u5199\u4E00\u4E2A\u5408\u9002\u7684\u540D\u79F0\uFF0C\u5728 **API \u9650\u5236** \u4E2D\u641C\u7D22\u5E76\u9009\u62E9 **Cloud Vision API**\uFF0C\u70B9\u51FB **\u521B\u5EFA**\u3002\n4. \u590D\u5236\u5E76\u5C06 API Key \u586B\u5165\u672C\u63D2\u4EF6\u4E2D\uFF0C\u91CD\u8F7D\u914D\u7F6E\u4EE5\u5E94\u7528\u3002";
export declare const inject: {
    required: string[];
    optional: string[];
};
