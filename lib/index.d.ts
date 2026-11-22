import type { Context } from 'cordis';
import type { Config } from './config.js';
export * from './config.js';
export declare const inject: string[];
interface CacheRow {
    key: string;
    payload: string;
    createdAt: Date;
    expiresAt: Date;
}
declare module '@cordisjs/plugin-database' {
    interface Tables {
        chatluna_reverse_image_v2_cache: CacheRow;
    }
}
export declare function apply(ctx: Context, cfg: Config): void;
