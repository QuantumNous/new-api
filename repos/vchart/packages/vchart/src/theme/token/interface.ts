/** 语义化 token 的索引 */
export interface ITokenKey<T = any> {
  /** type 声明 */
  type: 'token';
  /** token key */
  key: string;
  /** 默认值，在没有取到 key 对应的值时返回 */
  default?: T;
}

export type TokenMap = Record<string, any>;
