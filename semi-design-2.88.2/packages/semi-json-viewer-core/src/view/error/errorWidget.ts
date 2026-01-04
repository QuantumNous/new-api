import { Diagnostic } from '../../service/jsonTypes';
import { Emitter, getEmitter } from '../../common/emitter';
import { View } from '../view';
import { GlobalEvents } from '../../common/emitterEvents';

export class ErrorWidget {
    private _view: View;
    private emitter: Emitter<GlobalEvents> = getEmitter();
    private _problems: Diagnostic[] = [];
    constructor(view: View) {
        this._view = view;
        this._attachEventListeners();
    }

    private _attachEventListeners() {
        this.emitter.on('problemsChanged', (result: any) => {
            this._problems = result.problems;
            this.renderErrorLine();
        });
    }

    public renderErrorLine() {
        if (this._problems.length === 0) return;
        this._problems.forEach((problem: Diagnostic) => {
            const { start, end } = problem.range;
            const errMessage = problem.message;
            this.findDomByPos(start, end, errMessage);
        });
    }

    private findDomByPos(start: { lineNumber: number; column: number }, end: { lineNumber: number; column: number }, errMessage: string) {
        let line = this._view.getLineElement(start.lineNumber);
        line = line?.children[0] as HTMLElement;
        if (!line) return;
        let offset = 1;
        for (let i = 0; i < line.children.length; i++) {
            const child = line.children[i];
            offset += child.textContent?.length || 0;
            if (offset > start.column && offset <= end.column) {
                const className = `${this._view.prefixCls}-error`;
                child.classList.add(className);
            }
        }
    }
}
