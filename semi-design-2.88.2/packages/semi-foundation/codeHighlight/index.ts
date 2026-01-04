import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import Prism from 'prismjs';
import cls from "classnames";
import "prismjs/plugins/line-numbers/prism-line-numbers.min.js";

Prism.manual = true;

export interface CodeHighlightBaseProps {
    code: string;
    language: string;
    lineNumber: boolean
}

export interface CodeHighlightBaseState {

}

export interface CodeHighlightAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {

}


class CodeHighlightFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<CodeHighlightAdapter<P, S>, P, S> {
    constructor(adapter: CodeHighlightAdapter<P, S>) {
        super({ ...adapter });
    }


    highlightCode = (ele: HTMLElement, language: string) => {
        let className = ele.className;
        const languageClassName = `language-${language}`;
        if (!className.includes(languageClassName)) {
            className = cls(className, languageClassName);
        }
        if (this.getProp("lineNumber")) {
            className = cls(className, "line-numbers");
        }
        ele.className = className;
        Prism.highlightElement(ele, false);
    }

}


export default CodeHighlightFoundation;
