/** based on https://github.com/microsoft/vscode with modifications for custom requirements */
import { Emitter, getEmitter } from '../common/emitter';
import { GlobalEvents, IModelContentChangeEvent } from '../common/emitterEvents';
import { IRange } from '../common/range';
import { countEOL } from '../common/strings';
import { findFirstIdxMonotonousOrArrLen } from '../common/utils';
import { FoldingModel } from './foldingModel';

export class HiddenRangeModel {
    private _hiddenRanges: IRange[] = [];
    private _hasLineChanged: boolean = false;
    private _foldingModel: FoldingModel;
    private emitter: Emitter<GlobalEvents> = getEmitter();
    constructor(foldingModel: FoldingModel) {
        this._foldingModel = foldingModel;
        if (this._foldingModel.regions.length) {
            this.updateHiddenRanges();
        }
    }

    public updateHiddenRanges(): void {
        let updateHiddenAreas = false;
        const newHiddenAreas: IRange[] = [];
        let i = 0; // index into hidden
        let k = 0;

        let lastCollapsedStart = Number.MAX_VALUE;
        let lastCollapsedEnd = -1;

        const ranges = this._foldingModel.regions;
        for (; i < ranges.length; i++) {
            if (!ranges.isCollapsed(i)) {
                continue;
            }

            const startLineNumber = ranges.getStartLineNumber(i) + 1; // the first line is not hidden
            const endLineNumber = ranges.getEndLineNumber(i);
            if (lastCollapsedStart <= startLineNumber && endLineNumber <= lastCollapsedEnd) {
                // ignore ranges contained in collapsed regions
                continue;
            }

            if (
                !updateHiddenAreas &&
                k < this._hiddenRanges.length &&
                this._hiddenRanges[k].startLineNumber === startLineNumber &&
                this._hiddenRanges[k].endLineNumber === endLineNumber
            ) {
                // reuse the old ranges
                newHiddenAreas.push(this._hiddenRanges[k]);
                k++;
            } else {
                updateHiddenAreas = true;
                newHiddenAreas.push({ startLineNumber, startColumn: 1, endLineNumber, endColumn: 1 });
            }
            lastCollapsedStart = startLineNumber;
            lastCollapsedEnd = endLineNumber;
        }
        if (this._hasLineChanged || updateHiddenAreas || k < this._hiddenRanges.length) {
            this.applyHiddenRanges(newHiddenAreas);
        }
    }

    private applyHiddenRanges(newHiddenAreas: IRange[]): void {
        this._hasLineChanged = false;
        this._hiddenRanges = newHiddenAreas;
        this.emitter.emit('forceRender', undefined);
    }

    get hiddenRanges(): IRange[] {
        return this._hiddenRanges;
    }

    public isHiddenLine(lineNumber: number): boolean {
        return this.findRange(lineNumber, this._hiddenRanges) !== null;
    }

    public findRange(lineNumber: number, ranges: IRange[]): IRange | null {
        const i = findFirstIdxMonotonousOrArrLen(ranges, r => lineNumber < r.startLineNumber) - 1;
        if (i >= 0 && ranges[i].endLineNumber >= lineNumber) {
            return ranges[i];
        }
        return null;
    }
    public getHiddenLineCount(): number {
        let count = 0;
        for (const range of this._hiddenRanges) {
            count += range.endLineNumber - range.startLineNumber + 1;
        }
        return count;
    }

    notifyChangeModelContent(e: IModelContentChangeEvent | IModelContentChangeEvent[]): void {
        if (this._hiddenRanges.length && !this._hasLineChanged) {
            if (Array.isArray(e)) {
                this._hasLineChanged = e.some(change => {
                    return (
                        change.range.endLineNumber !== change.range.startLineNumber ||
                        countEOL(change.newText)[0] !== 0 ||
                        countEOL(change.oldText)[0] !== 0
                    );
                });
            } else {
                this._hasLineChanged =
                    e.range.endLineNumber !== e.range.startLineNumber ||
                    countEOL(e.newText)[0] !== 0 ||
                    countEOL(e.oldText)[0] !== 0;
            }
        }
    }
}
