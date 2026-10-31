import type { ITokenKey, TokenMap } from './interface';
export declare function queryToken<T>(tokenMap: TokenMap, tokenKey: ITokenKey<T>): T | undefined;
export declare function isTokenKey(obj: any): obj is ITokenKey;
