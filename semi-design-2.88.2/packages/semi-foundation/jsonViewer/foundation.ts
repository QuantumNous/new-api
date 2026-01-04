import { JsonViewer, JsonViewerOptions, CustomRenderRule } from '@douyinfe/semi-json-viewer-core';
import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { cssClasses } from './constants';
export type { JsonViewerOptions, CustomRenderRule };

export interface JsonViewerAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getEditorRef: () => HTMLElement;
    getSearchRef: () => HTMLInputElement;
    notifyChange: (value: string) => void;
    notifyHover: (value: string, el: HTMLElement) => HTMLElement | undefined;
    setSearchOptions: (key: string) => void;
    showSearchBar: () => void;
    notifyCustomRender: (customRenderMap: Map<HTMLElement, any>) => void
}

class JsonViewerFoundation extends BaseFoundation<JsonViewerAdapter> {
    constructor(adapter: JsonViewerAdapter) {
        super({ ...JsonViewerFoundation, ...adapter });
    }

    jsonViewer: JsonViewer | null = null;

    init() {
        const props = this.getProps();
        const editorRef = this._adapter.getEditorRef();
        this.jsonViewer = new JsonViewer(editorRef, props.value, {
            prefixCls: cssClasses.PREFIX,
            ...props.options
        });
        this.jsonViewer.emitter.on('customRender', (e) => {
            this._adapter.notifyCustomRender(e.customRenderMap);
        });
        this.jsonViewer.layout();
        this.jsonViewer.emitter.on('contentChanged', (e) => {
            this._adapter.notifyChange(this.jsonViewer?.getModel().getValue());
            if (this.getState('showSearchBar')) {
                this.search(this._adapter.getSearchRef().value);
            }
        });

    }

    search(searchText: string, caseSensitive?: boolean, wholeWord?: boolean, regex?: boolean) {
        let options;
        if (caseSensitive !== undefined || wholeWord !== undefined || regex !== undefined) {
            options = {
                caseSensitive: caseSensitive ?? false,
                wholeWord: wholeWord ?? false,
                regex: regex ?? false
            };
        } else {
            options = this.getState('searchOptions');
        }
        const { caseSensitive: cs, wholeWord: ww, regex: rx } = options;
        this.jsonViewer?.getSearchWidget().search(searchText, cs, ww, rx);
    }

    prevSearch(step?: number) {
        if (step === undefined) {
            this.jsonViewer?.getSearchWidget().navigateResults(-1);
        } else {
            this.jsonViewer?.getSearchWidget().navigateResults(-step);
        }
    }

    nextSearch(step?: number) {
        if (step === undefined) {
            this.jsonViewer?.getSearchWidget().navigateResults(1);
        } else {
            this.jsonViewer?.getSearchWidget().navigateResults(step);
        }
    }

    replace(replaceText: string) {
        if (this.getProps().options.readOnly) {
            return;
        }
        this.jsonViewer?.getSearchWidget().replace(replaceText);
    }

    replaceAll(replaceText: string) {
        if (this.getProps().options.readOnly) {
            return;
        }
        this.jsonViewer?.getSearchWidget().replaceAll(replaceText);
    }

    setSearchOptions(key: string) {
        this._adapter.setSearchOptions(key);
    }

    showSearchBar() {
        this._adapter.showSearchBar();
    }

    getSearchResults() {
        return this.jsonViewer?.getSearchWidget().searchResults;
    }
}

export default JsonViewerFoundation;