/** based on https://github.com/microsoft/vscode with modifications for custom requirements */
import { JSONModel } from '../../model/jsonModel';
import { Range } from '../../common/range';
import * as strings from '../../common/strings';
export enum IndentAction {
    None = 0,
    Indent = 1,
    IndentOutdent = 2,
    Outdent = 3,
}

interface JsonEnterResult {
    indentAction: IndentAction;
    appendText?: string;
    removeText?: number
}

export function getIndentationAtPosition(model: JSONModel, lineNumber: number, column: number) {
    const lineText = model.getLineContent(lineNumber);
    let indentation = strings.getLeadingWhitespace(lineText);
    if (indentation.length > column - 1) {
        indentation = indentation.substring(0, column - 1);
    }
    return indentation;
}

export function processJsonEnterAction(model: JSONModel, range: Range) {
    // 获取上下文信息
    const currentLineText = model.getLineContent(range.startLineNumber);
    const beforeText = currentLineText.substring(0, range.startColumn - 1);
    const afterText = currentLineText.substring(range.startColumn - 1);
    const previousLineText = range.startLineNumber > 1 ? model.getLineContent(range.startLineNumber - 1) : '';

    // 获取回车处理结果
    const enterResult: JsonEnterResult | null = onEnter(beforeText, afterText, previousLineText);
    if (!enterResult) {
        return null;
    }
    const indentAction = enterResult.indentAction;
    let appendText = enterResult.appendText;
    const removeText = enterResult.removeText || 0;
    if (!appendText) {
        if (indentAction === IndentAction.Indent || indentAction === IndentAction.IndentOutdent) {
            appendText = '\t';
        } else {
            appendText = '';
        }
    } else if (indentAction === IndentAction.Indent) {
        appendText = '\t' + appendText;
    }

    let indentation = getIndentationAtPosition(model, range.startLineNumber, range.startColumn);
    if (removeText) {
        indentation = indentation.substring(0, indentation.length - removeText);
    }

    return {
        indentAction: indentAction,
        appendText: appendText,
        removeText: removeText,
        indentation: indentation,
    };
}

function onEnter(beforeText: string, afterText: string, previousLineText: string) {
    const brackets = [
        { open: '{', openRegExp: /\{\s*$/, close: '}', closeRegExp: /^\s*\}/ },
        { open: '[', openRegExp: /\[\s*$/, close: ']', closeRegExp: /^\s*\]/ },
    ];
    if (beforeText.length > 0 && afterText.length > 0) {
        for (let i = 0, len = brackets.length; i < len; i++) {
            const bracket = brackets[i];
            if (bracket.openRegExp.test(beforeText) && bracket.closeRegExp.test(afterText)) {
                return { indentAction: IndentAction.IndentOutdent };
            }
        }
    }

    if (beforeText.length > 0) {
        for (let i = 0, len = brackets.length; i < len; i++) {
            const bracket = brackets[i];
            if (bracket.openRegExp.test(beforeText)) {
                return { indentAction: IndentAction.Indent };
            }
        }
    }

    return null;
}
