/** Based on https://github.com/microsoft/vscode-json-languageservice with modifications for custom requirements */
import { Position } from '../common/position';
import { Range } from '../common/range';
/**
 * Error codes used by diagnostics
 */
export enum ErrorCode {
    Undefined = 0,
    EnumValueMismatch = 1,
    Deprecated = 2,
    UnexpectedEndOfComment = 0x101,
    UnexpectedEndOfString = 0x102,
    UnexpectedEndOfNumber = 0x103,
    InvalidUnicode = 0x104,
    InvalidEscapeCharacter = 0x105,
    InvalidCharacter = 0x106,
    PropertyExpected = 0x201,
    CommaExpected = 0x202,
    ColonExpected = 0x203,
    ValueExpected = 0x204,
    CommaOrCloseBacketExpected = 0x205,
    CommaOrCloseBraceExpected = 0x206,
    TrailingComma = 0x207,
    DuplicateKey = 0x208,
    CommentNotPermitted = 0x209,
    PropertyKeysMustBeDoublequoted = 0x210,
    SchemaResolveError = 0x300,
    SchemaUnsupportedFeature = 0x301,
}

export type ASTNode =
    | ObjectASTNode
    | PropertyASTNode
    | ArrayASTNode
    | StringASTNode
    | NumberASTNode
    | BooleanASTNode
    | NullASTNode;

export interface BaseASTNode {
    readonly type: 'object' | 'array' | 'property' | 'string' | 'number' | 'boolean' | 'null';
    readonly parent?: ASTNode;
    readonly offset: number;
    readonly length: number;
    readonly children?: ASTNode[];
    readonly value?: string | boolean | number | null
}
export interface ObjectASTNode extends BaseASTNode {
    readonly type: 'object';
    readonly properties: PropertyASTNode[];
    readonly children: ASTNode[]
}
export interface PropertyASTNode extends BaseASTNode {
    readonly type: 'property';
    readonly keyNode: StringASTNode;
    readonly valueNode?: ASTNode;
    readonly colonOffset?: number;
    readonly children: ASTNode[]
}
export interface ArrayASTNode extends BaseASTNode {
    readonly type: 'array';
    readonly items: ASTNode[];
    readonly children: ASTNode[]
}
export interface StringASTNode extends BaseASTNode {
    readonly type: 'string';
    readonly value: string
}
export interface NumberASTNode extends BaseASTNode {
    readonly type: 'number';
    readonly value: number;
    readonly isInteger: boolean
}
export interface BooleanASTNode extends BaseASTNode {
    readonly type: 'boolean';
    readonly value: boolean
}
export interface NullASTNode extends BaseASTNode {
    readonly type: 'null';
    readonly value: null
}

export class Diagnostic {
    readonly message: string;
    readonly code: ErrorCode;
    readonly range: ErrRange;

    constructor(message: string, code: ErrorCode, range: ErrRange) {
        this.message = message;
        this.code = code;
        this.range = range;
    }

    static create(message: string, code: ErrorCode, range: ErrRange) {
        return new Diagnostic(message, code, range);
    }
}

export class ErrRange {
    readonly start: Position;
    readonly end: Position;

    constructor(start: Position, end: Position) {
        this.start = start;
        this.end = end;
    }
    static create(start: Position, end: Position) {
        return new ErrRange(start, end);
    }
}

export type MarkupKind = 'plaintext' | 'markdown';

export interface MarkupContent {
    kind: MarkupKind;

    value: string
}

export interface CompletionItemLabelDetails {
    detail?: string;
    description?: string
}

export namespace CompletionItemKind {
    export const Text: 1 = 1;
    export const Method: 2 = 2;
    export const Function: 3 = 3;
    export const Constructor: 4 = 4;
    export const Field: 5 = 5;
    export const Variable: 6 = 6;
    export const Class: 7 = 7;
    export const Interface: 8 = 8;
    export const Module: 9 = 9;
    export const Property: 10 = 10;
    export const Unit: 11 = 11;
    export const Value: 12 = 12;
    export const Enum: 13 = 13;
    export const Keyword: 14 = 14;
    export const Snippet: 15 = 15;
    export const Color: 16 = 16;
    export const File: 17 = 17;
    export const Reference: 18 = 18;
    export const Folder: 19 = 19;
    export const EnumMember: 20 = 20;
    export const Constant: 21 = 21;
    export const Struct: 22 = 22;
    export const Event: 23 = 23;
    export const Operator: 24 = 24;
    export const TypeParameter: 25 = 25;
}

export type CompletionItemKind =
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19
    | 20
    | 21
    | 22
    | 23
    | 24
    | 25;

export namespace InsertTextFormat {
    /**
     * The primary text to be inserted is treated as a plain string.
     */
    export const PlainText: 1 = 1;

    /**
     * The primary text to be inserted is treated as a snippet.
     *
     * A snippet can define tab stops and placeholders with `$1`, `$2`
     * and `${3:foo}`. `$0` defines the final tab stop, it defaults to
     * the end of the snippet. Placeholders with equal identifiers are linked,
     * that is typing in one will update others too.
     *
     * See also: https://microsoft.github.io/language-server-protocol/specifications/specification-current/#snippet_syntax
     */
    export const Snippet: 2 = 2;
}

export type InsertTextFormat = 1 | 2;

export interface TextEdit {
    range: Range;

    newText: string
}

export namespace TextEdit {
    export function replace(range: Range, newText: string): TextEdit {
        return {
            range,
            newText,
        };
    }
}

export interface CompletionItem {
    label: string;
    detail?: string;
    labelDetails?: CompletionItemLabelDetails;
    documentation?: string | MarkupContent;
    kind?: CompletionItemKind;
    insertText?: string;
    insertTextFormat?: InsertTextFormat;
    filterText?: string;
    textEdit?: TextEdit
}
export namespace CompletionItem {
    export function create(label: string): CompletionItem {
        return { label };
    }
}

export interface CompletionList {
    items: CompletionItem[];
    isIncomplete: boolean
}
