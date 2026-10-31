export interface ITokenKey<T = any> {
    type: 'token';
    key: string;
    default?: T;
}
export type TokenMap = Record<string, any>;
