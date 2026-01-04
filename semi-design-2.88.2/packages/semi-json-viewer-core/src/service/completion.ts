/** Based on https://github.com/microsoft/vscode-json-languageservice with modifications for custom requirements */
import { Position } from '../common/position';
import { JSONModel } from '../model/jsonModel';
import { JsonDocument } from './parse';
import { Range } from '../common/range';
import * as Json from 'jsonc-parser';
import * as Parser from './parse';
import {
    ASTNode,
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    InsertTextFormat,
    ObjectASTNode,
    PropertyASTNode,
    TextEdit,
} from './jsonTypes';
import { CompletionsCollector, JSONCompletionItem } from './contribution';
import { CompletionOptions } from '../json-viewer/jsonViewer';

/**
 * Json补全功能的核心实现
 */
export class JSONCompletion {
    private _options: CompletionOptions | null;

    constructor(options: CompletionOptions | null) {
        this._options = options;
    }

    public doCompletion(jsonModel: JSONModel, position: Position, doc: JsonDocument) {
        const result: CompletionList = {
            items: [],
            isIncomplete: false,
        };
        const text = jsonModel.getValue();

        const offset = jsonModel.getOffsetAt(position.lineNumber, position.column);

        let node = doc.getNodeFromOffset(offset, true);

        if (node && offset === node.offset + node.length && offset > 0) {
            const ch = text[offset - 1];
            if ((node.type === 'object' && ch === '}') || (node.type === 'array' && ch === ']')) {
                node = node.parent;
            }
        }

        const currentWord = this.getCurrentWord(jsonModel, offset);
        let overwriteRange: Range;
        if (
            node &&
            (node.type === 'string' || node.type === 'number' || node.type === 'boolean' || node.type === 'null')
        ) {
            overwriteRange = Range.create(
                jsonModel.positionAt(node.offset),
                jsonModel.positionAt(node.offset + node.length)
            );
        } else {
            let overwriteStart = offset - currentWord.length;
            if (overwriteStart > 0 && text[overwriteStart - 1] === '"') {
                overwriteStart--;
            }
            overwriteRange = Range.create(jsonModel.positionAt(overwriteStart), position);
        }
        const proposed = new Map<string, CompletionItem>();

        const collector: CompletionsCollector = {
            add: (suggestion: JSONCompletionItem) => {
                let label = suggestion.label;
                const existing = proposed.get(label);
                if (!existing) {
                    label = label.replace(/[\n]/g, '↵');
                    if (label.length > 60) {
                        const shortenedLabel = label.substring(0, 57).trim() + '...';
                        if (!proposed.has(shortenedLabel)) {
                            label = shortenedLabel;
                        }
                    }
                    suggestion.textEdit = TextEdit.replace(overwriteRange as Range, suggestion.insertText);
                    suggestion.label = label;
                    proposed.set(label, suggestion);
                    result.items.push(suggestion);
                } else {
                    if (!existing.documentation) {
                        existing.documentation = suggestion.documentation;
                    }
                    if (!existing.detail) {
                        existing.detail = suggestion.detail;
                    }
                    if (!existing.labelDetails) {
                        existing.labelDetails = suggestion.labelDetails;
                    }
                }
            },
            setAsIncomplete: () => {
                result.isIncomplete = true;
            },
            error: (message: string) => {
                console.error(message);
            },
            getNumberOfProposals: () => {
                return result.items.length;
            },
        };

        return Promise.resolve().then(() => {
            const collectionPromises: Promise<any>[] = [];

            let addValue = true;
            let currentKey = '';

            let currentProperty: PropertyASTNode | undefined = undefined;
            if (node) {
                if (node.type === 'string') {
                    const parent = node.parent;
                    if (parent && parent.type === 'property' && parent.keyNode === node) {
                        addValue = !parent.valueNode;
                        currentProperty = parent;
                        currentKey = text.substr(node.offset + 1, node.length - 2);
                        if (parent) {
                            node = parent.parent;
                        }
                    }
                }
            }

            if (node && node.type === 'object') {
                if (node.offset === offset) {
                    return result;
                }
                const properties = node.properties;
                properties.forEach(p => {
                    if (!currentProperty || currentProperty !== p) {
                        proposed.set(p.keyNode.value, CompletionItem.create('__'));
                    }
                });
                let separatorAfter = '';
                if (addValue) {
                    separatorAfter = this.evaluateSeparatorAfter(
                        jsonModel,
                        jsonModel.getOffsetAt(overwriteRange.endLineNumber, overwriteRange.endColumn)
                    );
                }

                // property proposals without schema
                this.getSchemaLessPropertyCompletions(doc, node, currentKey, collector, currentWord);

                // const location = Parser.getNodePath(node);
                if (currentWord.length > 0 && text.charAt(offset - currentWord.length - 1) !== '"') {
                    collector.add({
                        kind: CompletionItemKind.Property,
                        label: this.getLabelForValue(currentWord),
                        insertText: this.getInsertTextForProperty(currentWord, undefined, false, separatorAfter),
                        insertTextFormat: InsertTextFormat.Snippet,
                        documentation: '',
                    });
                    collector.setAsIncomplete();
                }
            }
            const types: { [type: string]: boolean } = {};

            // value proposals without schema
            this.getSchemaLessValueCompletions(doc, node, offset, jsonModel, collector);

            return Promise.all(collectionPromises).then(() => {
                if (collector.getNumberOfProposals() === 0) {
                    let offsetForSeparator = offset;
                    if (
                        node &&
                        (node.type === 'string' ||
                            node.type === 'number' ||
                            node.type === 'boolean' ||
                            node.type === 'null')
                    ) {
                        offsetForSeparator = node.offset + node.length;
                    }
                    const separatorAfter = this.evaluateSeparatorAfter(jsonModel, offsetForSeparator);
                    this.addFillerValueCompletions(types, separatorAfter, collector);
                } else if (this._options?.staticCompletions) {
                    this._options.staticCompletions.forEach(item => {
                        collector.add({
                            label: item.label,
                            insertText: item.insertText || item.label,
                            documentation: item.documentation || '',
                        });
                    });
                }
                return result;
            });
        });
    }

    /**
     * 获取光标位置前的当前单词
     * @param jsonModel
     * @param offset
     * @returns
     */
    private getCurrentWord(jsonModel: JSONModel, offset: number) {
        let i = offset - 1;
        const text = jsonModel.getValue();
        while (i >= 0 && ' \t\n\r\v":{[,]}'.indexOf(text.charAt(i)) === -1) {
            i--;
        }
        return text.substring(i + 1, offset);
    }

    private evaluateSeparatorAfter(jsonModel: JSONModel, offset: number) {
        const scanner = Json.createScanner(jsonModel.getValue(), true);
        scanner.setPosition(offset);
        const token = scanner.scan();
        switch (token) {
            case Json.SyntaxKind.CommaToken:
            case Json.SyntaxKind.CloseBraceToken:
            case Json.SyntaxKind.CloseBracketToken:
            case Json.SyntaxKind.EOF:
                return '';
            default:
                return ',';
        }
    }

    private getLabelForValue(value: any): string {
        return JSON.stringify(value);
    }

    private getInsertTextForPlainText(text: string): string {
        return text.replace(/[\\\$\}]/g, '\\$&'); // escape $, \ and }
    }

    private getInsertTextForValue(value: any, separatorAfter: string): string {
        const text = JSON.stringify(value, null, '\t');
        if (text === '{}') {
            return '{$1}' + separatorAfter;
        } else if (text === '[]') {
            return '[$1]' + separatorAfter;
        }
        return this.getInsertTextForPlainText(text + separatorAfter);
    }

    private getFilterTextForValue(value: any): string {
        return JSON.stringify(value);
    }

    private getInsertTextForProperty(
        key: string,
        propertySchema: undefined,
        addValue: boolean,
        separatorAfter: string
    ): string {
        const propertyText = this.getInsertTextForValue(key, '');
        if (!addValue) {
            return propertyText;
        }
        const resultText = propertyText + ': ';

        let value;
        const nValueProposals = 0;
        if (propertySchema) {
            //TODO
        }
        if (!value || nValueProposals > 1) {
            value = '$1';
        }
        return resultText + value + separatorAfter;
    }

    private getSchemaLessPropertyCompletions(
        doc: Parser.JsonDocument,
        node: ASTNode,
        currentKey: string,
        collector: CompletionsCollector,
        currentWord: string
    ): void {
        const collectCompletionsForSimilarObject = (obj: ObjectASTNode) => {
            obj.properties.forEach(p => {
                const key = p.keyNode.value;
                if (key.toLowerCase().startsWith(currentWord.toLowerCase()) && currentWord !== '') {
                    collector.add({
                        kind: CompletionItemKind.Property,
                        label: key,
                        insertText: this.getInsertTextForValue(key, ''),
                        insertTextFormat: InsertTextFormat.Snippet,
                        filterText: this.getFilterTextForValue(key),
                        documentation: '',
                    });
                }
            });
        };
        if (node.parent) {
            if (node.parent.type === 'property') {
                // if the object is a property value, check the tree for other objects that hang under a property of the same name
                const parentKey = node.parent.keyNode.value;
                doc.visit(n => {
                    if (
                        n.type === 'property' &&
                        n !== node.parent &&
                        n.keyNode.value === parentKey &&
                        n.valueNode &&
                        n.valueNode.type === 'object'
                    ) {
                        collectCompletionsForSimilarObject(n.valueNode);
                    }
                    return true;
                });
            } else if (node.parent.type === 'array') {
                // if the object is in an array, use all other array elements as similar objects
                node.parent.items.forEach(n => {
                    if (n.type === 'object' && n !== node) {
                        collectCompletionsForSimilarObject(n);
                    }
                });
            }
        }
        // else if (node.type === 'object') {
        // 	collector.add({
        // 		kind: CompletionItemKind.Property,
        // 		label: '$schema',
        // 		insertText: this.getInsertTextForProperty(
        // 			'$schema',
        // 			undefined,
        // 			true,
        // 			''
        // 		),
        // 		insertTextFormat: InsertTextFormat.Snippet,
        // 		documentation: '',
        // 		filterText: this.getFilterTextForValue('$schema')
        // 	});
        // }
    }

    private addFillerValueCompletions(
        types: { [type: string]: boolean },
        separatorAfter: string,
        collector: CompletionsCollector
    ): void {
        if (types['object']) {
            collector.add({
                kind: this.getSuggestionKind('object'),
                label: '{}',
                insertText: this.getInsertTextForGuessedValue({}, separatorAfter),
                insertTextFormat: InsertTextFormat.Snippet,
                detail: 'New object',
                documentation: '',
            });
        }
        if (types['array']) {
            collector.add({
                kind: this.getSuggestionKind('array'),
                label: '[]',
                insertText: this.getInsertTextForGuessedValue([], separatorAfter),
                insertTextFormat: InsertTextFormat.Snippet,
                detail: 'New array',
                documentation: '',
            });
        }
    }

    private getInsertTextForGuessedValue(value: any, separatorAfter: string): string {
        switch (typeof value) {
            case 'object':
                if (value === null) {
                    return '${1:null}' + separatorAfter;
                }
                return this.getInsertTextForValue(value, separatorAfter);
            case 'string':
                let snippetValue = JSON.stringify(value);
                snippetValue = snippetValue.substr(1, snippetValue.length - 2); // remove quotes
                snippetValue = this.getInsertTextForPlainText(snippetValue); // escape \ and }
                return '"${1:' + snippetValue + '}"' + separatorAfter;
            case 'number':
            case 'boolean':
                return '${1:' + JSON.stringify(value) + '}' + separatorAfter;
        }
        return this.getInsertTextForValue(value, separatorAfter);
    }

    private getSuggestionKind(type: any): CompletionItemKind {
        if (Array.isArray(type)) {
            const array = <any[]>type;
            type = array.length > 0 ? array[0] : undefined;
        }
        if (!type) {
            return CompletionItemKind.Value;
        }
        switch (type) {
            case 'string':
                return CompletionItemKind.Value;
            case 'object':
                return CompletionItemKind.Module;
            case 'property':
                return CompletionItemKind.Property;
            default:
                return CompletionItemKind.Value;
        }
    }

    private getSchemaLessValueCompletions(
        doc: Parser.JsonDocument,
        node: ASTNode | undefined,
        offset: number,
        jsonModel: JSONModel,
        collector: CompletionsCollector
    ): void {
        let offsetForSeparator = offset;
        if (
            node &&
            (node.type === 'string' || node.type === 'number' || node.type === 'boolean' || node.type === 'null')
        ) {
            offsetForSeparator = node.offset + node.length;
            node = node.parent;
        }

        if (!node) {
            // collector.add({
            // 	kind: this.getSuggestionKind('object'),
            // 	label: 'Empty object',
            // 	insertText: this.getInsertTextForValue({}, ''),
            // 	insertTextFormat: InsertTextFormat.Snippet,
            // 	documentation: ''
            // });
            // collector.add({
            // 	kind: this.getSuggestionKind('array'),
            // 	label: 'Empty array',
            // 	insertText: this.getInsertTextForValue([], ''),
            // 	insertTextFormat: InsertTextFormat.Snippet,
            // 	documentation: ''
            // });
            return;
        }
        const separatorAfter = this.evaluateSeparatorAfter(jsonModel, offsetForSeparator);
        const collectSuggestionsForValues = (value: ASTNode) => {
            if (value.parent && !Parser.contains(value.parent, offset, true)) {
                collector.add({
                    kind: this.getSuggestionKind(value.type),
                    label: this.getLabelTextForMatchingNode(value, jsonModel),
                    insertText: this.getInsertTextForMatchingNode(value, jsonModel, separatorAfter),
                    insertTextFormat: InsertTextFormat.Snippet,
                    documentation: '',
                });
            }
            // if (value.type === 'boolean') {
            //     this.addBooleanValueCompletion(!value.value, separatorAfter, collector);
            // }
        };

        if (node.type === 'property') {
            if (offset > (node.colonOffset || 0)) {
                const valueNode = node.valueNode;
                if (
                    valueNode &&
                    (offset > valueNode.offset + valueNode.length ||
                        valueNode.type === 'object' ||
                        valueNode.type === 'array')
                ) {
                    return;
                }
                // suggest values at the same key
                const parentKey = node.keyNode.value;
                doc.visit(n => {
                    if (n.type === 'property' && n.keyNode.value === parentKey && n.valueNode) {
                        collectSuggestionsForValues(n.valueNode);
                    }
                    return true;
                });
                // if (parentKey === '$schema' && node.parent && !node.parent.parent) {
                // 	this.addDollarSchemaCompletions(separatorAfter, collector);
                // }
            }
        }
        if (node.type === 'array') {
            if (node.parent && node.parent.type === 'property') {
                // suggest items of an array at the same key
                const parentKey = node.parent.keyNode.value;
                doc.visit(n => {
                    if (
                        n.type === 'property' &&
                        n.keyNode.value === parentKey &&
                        n.valueNode &&
                        n.valueNode.type === 'array'
                    ) {
                        n.valueNode.items.forEach(collectSuggestionsForValues);
                    }
                    return true;
                });
            } else {
                // suggest items in the same array
                node.items.forEach(collectSuggestionsForValues);
            }
        }
    }
    private getLabelTextForMatchingNode(node: ASTNode, jsonModel: JSONModel): string {
        switch (node.type) {
            case 'array':
                return '[]';
            case 'object':
                return '{}';
            default:
                const content = jsonModel.getValue().substr(node.offset, node.length);
                return content;
        }
    }

    private getInsertTextForMatchingNode(node: ASTNode, jsonModel: JSONModel, separatorAfter: string): string {
        switch (node.type) {
            case 'array':
                return this.getInsertTextForValue([], separatorAfter);
            case 'object':
                return this.getInsertTextForValue({}, separatorAfter);
            default:
                const content = jsonModel.getValue().substr(node.offset, node.length) + separatorAfter;
                return this.getInsertTextForPlainText(content);
        }
    }

    private addBooleanValueCompletion(value: boolean, separatorAfter: string, collector: CompletionsCollector): void {
        collector.add({
            kind: this.getSuggestionKind('boolean'),
            label: value ? 'true' : 'false',
            insertText: this.getInsertTextForValue(value, separatorAfter),
            insertTextFormat: InsertTextFormat.Snippet,
            documentation: '',
        });
    }
}
