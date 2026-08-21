import type { ITokenKey, TokenMap } from './interface';

/**
 * 根据 tokenMap 和 token 索引查询 token 值
 */
export function queryToken<T>(tokenMap: TokenMap, tokenKey: ITokenKey<T>): T | undefined {
  if (tokenMap && tokenKey.key in tokenMap) {
    return tokenMap[tokenKey.key];
  }
  return tokenKey.default;
}

export function isTokenKey(obj: any): obj is ITokenKey {
  return obj && (obj as ITokenKey).type === 'token' && !!(obj as ITokenKey).key;
}
