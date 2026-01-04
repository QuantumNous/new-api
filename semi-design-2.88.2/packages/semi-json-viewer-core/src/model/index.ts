import { JSONModel } from './jsonModel';

export function createModel(text: string, normalizeEOL: boolean = true): JSONModel {
    return new JSONModel(text, normalizeEOL);
}
