import { JSONModel } from '../model/jsonModel';
import { format, FormattingOptions } from 'jsonc-parser';
import { JsonDocument, parseJson } from './parse';
import { Diagnostic } from './jsonTypes';
export { getFoldingRanges } from './getRange';

/**
 * Json 服务，提供json格式化、补全、折叠等功能
 */

export interface FoldingRange {
    startLine: number;
    endLine: number;
    kind: 'object' | 'array'
}

export function formatJson(jsonModel: JSONModel, options: FormattingOptions) {
    const edits = format(jsonModel.getValue(), undefined, options);
    return edits;
}

export function doValidate(jsonModel: JSONModel) {
    const { root, problems } = parseJson(jsonModel);
    return {
        problems,
        root,
    };
}

export function parseJsonAst(jsonModel: JSONModel) {
    return parseJson(jsonModel).root;
}
