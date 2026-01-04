import { View } from '../view/view';
import { JSONModel } from '../model/jsonModel';
import { disposeEmitter, Emitter, getEmitter } from '../common/emitter';
import { createModel } from '../model';
import { disposeWorkerManager, getJsonWorkerManager, JsonWorkerManager } from '../worker/jsonWorkerManager';
import { CompletionItem } from '../service/jsonTypes';
import { GlobalEvents } from '../common/emitterEvents';
import { setCurrentNameSpaceId } from '../common/nameSpace';
/**
 * JsonViewer 主类
 */
export interface JsonViewerOptions {
    lineHeight?: number;
    autoWrap?: boolean;
    readOnly?: boolean;
    formatOptions?: FormattingOptions;
    completionOptions?: CompletionOptions;
    customRenderRule?: CustomRenderRule[];
    prefixCls?: string
}

export interface CompletionOptions {
    staticCompletions?: CompletionItem[]
}

export interface FormattingOptions {
    tabSize?: number;
    insertSpaces?: boolean;
    eol?: string
}

export interface CustomRenderRule {
    match: string | RegExp | ((value: string, pathChain: string) => boolean);
    render: (value: string) => HTMLElement
}

export class JsonViewer {
    private _container: HTMLElement;
    private _jsonModel: JSONModel;
    private _view: View;
    private _jsonWorkerManager: JsonWorkerManager | null = null;
    public emitter: Emitter<GlobalEvents>;
    private _id: string = `jsonviewer-${Math.random().toString(36).substr(2, 9)}`;

    constructor(container: HTMLElement, value: string, options?: JsonViewerOptions) {
        setCurrentNameSpaceId(this._id);
        this.emitter = getEmitter();
        this._container = container;
        this._jsonModel = createModel(value);
        this._jsonWorkerManager = getJsonWorkerManager();
        this._jsonWorkerManager.init(value);
        this._view = new View(container, this._jsonModel, options);
    }

    layout() {
        this._view.layout();
    }

    getModel() {
        return this._jsonModel;
    }

    getSearchWidget() {
        return this._view.searchWidget;
    }

    format() {
        this._view.editWidget.format();
    }

    dispose() {
        disposeEmitter(this._id);
        disposeWorkerManager(this._id);
        this._view.dispose();
    }
}
