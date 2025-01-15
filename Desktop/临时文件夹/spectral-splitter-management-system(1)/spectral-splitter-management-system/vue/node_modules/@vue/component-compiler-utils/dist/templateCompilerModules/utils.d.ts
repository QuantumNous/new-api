import { TransformAssetUrlsOptions } from './assetUrl';
export interface Attr {
    name: string;
    value: string;
}
export interface ASTNode {
    tag: string;
    attrs: Attr[];
}
export declare function urlToRequire(url: string, transformAssetUrlsOption?: TransformAssetUrlsOptions): string;
