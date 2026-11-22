import type { Http } from '@cordisjs/plugin-http';
export declare function downloadImage(http: Http, source: string, options: {
    signal: AbortSignal;
    timeout: number;
    proxyAgent?: string;
}): Promise<string>;
