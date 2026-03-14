import { Context } from 'koishi';
import { Config } from './config';
type StorageService = {
    config?: {
        serverPath?: string;
    };
    createTempFile: (buffer: Buffer, filename: string, ttlHours: number) => Promise<{
        url: string;
    }>;
};
type WebDetection = {
    webEntities?: Array<{
        entityId?: string;
        score?: number;
        description?: string;
    }>;
    fullMatchingImages?: Array<{
        url?: string;
    }>;
    partialMatchingImages?: Array<{
        url?: string;
    }>;
    pagesWithMatchingImages?: Array<{
        url?: string;
        pageTitle?: string;
    }>;
    visuallySimilarImages?: Array<{
        url?: string;
    }>;
    bestGuessLabels?: Array<{
        label?: string;
        languageCode?: string;
    }>;
};
type ScrapingdogResponse = {
    html?: unknown;
    exact_matches?: Array<{
        title?: string;
        source?: string;
        link?: string;
        url?: string;
        thumbnail?: string;
        image?: string;
    }>;
    visual_matches?: Array<{
        title?: string;
        source?: string;
        link?: string;
        url?: string;
        thumbnail?: string;
        image?: string;
    }>;
    lens_results?: Array<{
        title?: string;
        source?: string;
        link?: string;
        url?: string;
        thumbnail?: string;
        image?: string;
    }>;
    related_searches?: Array<{
        title?: string;
    }>;
    error?: string;
};
type GoogleResultPayload = {
    provider: 'google';
    imageUrl: string;
    webDetection: WebDetection;
};
type ScrapingdogResultPayload = {
    provider: 'scrapingdog';
    imageUrl: string;
} & Omit<ScrapingdogResponse, 'related_searches'>;
type OutputPayload = GoogleResultPayload | ScrapingdogResultPayload;
type CacheRow = {
    key: string;
    payload: OutputPayload;
    createdAt: Date;
    expiresAt: string | number | Date;
};
declare module 'koishi' {
    interface Tables {
        chatluna_google_reverse_image_cache: CacheRow;
    }
    interface Context {
        chatluna_storage?: StorageService;
    }
}
export declare function apply(ctx: Context, cfg: Config): void;
export * from './config';
