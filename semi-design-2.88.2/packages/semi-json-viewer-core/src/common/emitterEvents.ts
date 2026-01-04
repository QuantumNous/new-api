import { JsonDocument } from '../service/parse';
import { Diagnostic } from '../service/jsonTypes';

export interface GlobalEvents {
    tokensChanged: IModelTokensChangedEvent;
    contentChanged: IModelContentChangeEvent | IModelContentChangeEvent[];
    problemsChanged: IProblemsChangedEvent;
    hoverNode: IHoverNodeEvent;
    renderHoverNode: IRenderHoverNodeEvent;
    forceRender: undefined;
    customRender: ICustomRenderEvent
}

interface IRange {
    startLineNumber: number;

    startColumn: number;

    endLineNumber: number;

    endColumn: number
}

export interface IModelTokensChangedEvent {
    range: {
        from: number;
        to: number
    }
}

export interface IModelContentChangeEvent {
    type: 'insert' | 'delete' | 'replace';
    range: IRange;
    rangeOffset: number;
    rangeLength: number;
    oldText: string;
    newText: string;
    keepPosition?: { lineNumber: number; column: number }
}

export interface IProblemsChangedEvent {
    root: JsonDocument;
    problems: Diagnostic[]
}

export interface IRenderHoverNodeEvent {
    el: HTMLElement
}

export interface IHoverNodeEvent {
    value: string;
    target: HTMLElement
}

export interface ICustomRenderEvent {
    customRenderMap: ICustomRenderMap
}

export type ICustomRenderMap = Map<HTMLElement, any>;