/** based on https://github.com/microsoft/vscode with modifications for custom requirements */
import { JSONModel } from './jsonModel';
import { Emitter, getEmitter } from '../common/emitter';
import { getJsonWorkerManager, JsonWorkerManager } from '../worker/jsonWorkerManager';
import { GlobalEvents } from '../common/emitterEvents';
import { FoldingRegion, FoldingRegions, FoldRange, FoldSource } from './foldingRange';
import { HiddenRangeModel } from './hiddenRangeModel';

/**
 * 折叠模型，管理JSON的折叠范围
 */
export class FoldingModel {
    private _jsonModel: JSONModel;
    private _regions: FoldingRegions | null = null;
    private _hiddenRangeModel: HiddenRangeModel;
    private _jsonWorkerManager: JsonWorkerManager = getJsonWorkerManager();
    private emitter: Emitter<GlobalEvents> = getEmitter();

    get regions() {
        return this._regions;
    }
    constructor(jsonModel: JSONModel) {
        this._jsonModel = jsonModel;
        // this.emitter.on('problemsChanged', e => {
        //     this.updateFoldingRanges();
        // });
        this.updateFoldingRanges();
        this.emitter.on('contentChanged', e => {
            this._hiddenRangeModel.notifyChangeModelContent(e);
        });

        this.emitter.on('problemsChanged', e => {
            this._jsonWorkerManager.foldRange().then(ranges => {
                const newRegions = FoldingRegions.fromFoldRanges(ranges);
                this.update(newRegions);
                this._hiddenRangeModel.updateHiddenRanges();
            });
        });
    }

    public updateFoldingRanges(): void {
        this._jsonWorkerManager.foldRange().then(ranges => {
            this._regions = FoldingRegions.fromFoldRanges(ranges);
            this._hiddenRangeModel = new HiddenRangeModel(this);
        });
    }

    public update(newRegions: FoldingRegions, blockedLineNumers: number[] = []): void {
        const foldedOrManualRanges = this._currentFoldedOrManualRanges(blockedLineNumers, newRegions);
        const newRanges = FoldingRegions.sanitizeAndMerge(
            newRegions,
            foldedOrManualRanges,
            this._jsonModel.getLineCount()
        );
        this._regions = FoldingRegions.fromFoldRanges(newRanges);
    }

    private _currentFoldedOrManualRanges(blockedLineNumers: number[] = [], newRegions?: FoldingRegions): FoldRange[] {
        const isBlocked = (startLineNumber: number, endLineNumber: number) => {
            if (newRegions) {
                const index = newRegions.findRange(startLineNumber);
                if (index === -1) return true;
                
                const region = newRegions.toRegion(index);
                if (!region || region.endLineNumber !== endLineNumber) return true;
            }
            
            for (const blockedLineNumber of blockedLineNumers) {
                if (startLineNumber < blockedLineNumber && blockedLineNumber <= endLineNumber) {
                    return true;
                }
            }
            return false;
        };

        const foldedRanges: FoldRange[] = [];
        for (let i = 0; i < this._regions.length; i++) {
            if (this._regions.isCollapsed(i)) {
                const startLineNumber = this._regions.getStartLineNumber(i);
                const endLineNumber = this._regions.getEndLineNumber(i);
                
                if (!isBlocked(startLineNumber, endLineNumber)) {
                    foldedRanges.push({
                        startLineNumber,
                        endLineNumber,
                        isCollapsed: true,
                        source: FoldSource.provider,
                        type: this._regions.getType(i),
                    });
                }
            }
        }
        return foldedRanges;
    }

    public toggleCollapseState(toggledRegions: FoldingRegion[]) {
        if (!toggledRegions.length) {
            return;
        }
        toggledRegions = toggledRegions.sort((r1, r2) => r1.regionIndex - r2.regionIndex);
        for (const region of toggledRegions) {
            const index = region.regionIndex;
            const newCollapsed = !this._regions.isCollapsed(index);
            this._regions.setCollapsed(index, newCollapsed);
        }
        this._hiddenRangeModel.updateHiddenRanges();
    }

    public toggleFoldingRange(startLine: number): void {
        toggleCollapseState(this, 1, [startLine]);
    }

    public isCollapsed(lineNumber: number): boolean {
        if (!this._regions) return false;
        const index = this._regions.findRange(lineNumber);
        const region = this._regions.toRegion(index);
        return region && region.isCollapsed;
    }

    public isLineCollapsed(lineNumber: number): boolean {
        if (!this._regions) return false;
        return this._hiddenRangeModel.isHiddenLine(lineNumber);
    }

    public isFoldable(lineNumber: number): boolean {
        if (!this._regions) return false;
        const index = this._regions.findRange(lineNumber);
        const region = this._regions.toRegion(index);
        return region && region.startLineNumber === lineNumber;
    }

    public getVisibleLineCount(): number {
        if (!this._regions || !this._hiddenRangeModel) return this._jsonModel.getLineCount();
        return this._jsonModel.getLineCount() - this._hiddenRangeModel.getHiddenLineCount();
    }
    
    public getActualLineNumber(visibleLineNumber: number): number {
        if (!this._regions || !this._hiddenRangeModel) return visibleLineNumber;
        
        let actualLine = visibleLineNumber;
        const hiddenRanges = this._hiddenRangeModel.hiddenRanges;
        for (const range of hiddenRanges) {
            if (range.startLineNumber <= actualLine) {
                actualLine += (range.endLineNumber - range.startLineNumber + 1);
            } else {
                break;
            }
        }
        return actualLine;
    }

    public getNextVisibleLine(actualLineNumber: number): number {
        if (!this._regions || !this._hiddenRangeModel) return actualLineNumber + 1;
        let nextLine = actualLineNumber + 1;
        const hiddenRanges = this._hiddenRangeModel.hiddenRanges;
        const containingRange = this._hiddenRangeModel.findRange(nextLine, hiddenRanges);
        if (containingRange) {
            return containingRange.endLineNumber + 1;
        }
        return nextLine;
    }

    getRegionAtLine(lineNumber: number): FoldingRegion | null {
        if (this._regions) {
            const index = this._regions.findRange(lineNumber);
            if (index >= 0) {
                return this._regions.toRegion(index);
            }
        }
        return null;
    }

    getRegionsInside(region: FoldingRegion | null, filter?: RegionFilter | RegionFilterWithLevel): FoldingRegion[] {
        const result: FoldingRegion[] = [];
        const index = region ? region.regionIndex + 1 : 0;
        const endLineNumber = region ? region.endLineNumber : Number.MAX_VALUE;

        if (filter && filter.length === 2) {
            const levelStack: FoldingRegion[] = [];
            for (let i = index, len = this._regions.length; i < len; i++) {
                const current = this._regions.toRegion(i);
                if (this._regions.getStartLineNumber(i) < endLineNumber) {
                    while (levelStack.length > 0 && !current.containedBy(levelStack[levelStack.length - 1])) {
                        levelStack.pop();
                    }
                    levelStack.push(current);
                    if (filter(current, levelStack.length)) {
                        result.push(current);
                    }
                } else {
                    break;
                }
            }
        } else {
            for (let i = index, len = this._regions.length; i < len; i++) {
                const current = this._regions.toRegion(i);
                if (this._regions.getStartLineNumber(i) < endLineNumber) {
                    if (!filter || (filter as RegionFilter)(current)) {
                        result.push(current);
                    }
                } else {
                    break;
                }
            }
        }
        return result;
    }
}

type RegionFilter = (r: FoldingRegion) => boolean;
type RegionFilterWithLevel = (r: FoldingRegion, level: number) => boolean;

/**
 * Collapse or expand the regions at the given locations
 * @param levels The number of levels. Use 1 to only impact the regions at the location, use Number.MAX_VALUE for all levels.
 * @param lineNumbers the location of the regions to collapse or expand, or if not set, all regions in the model.
 */
export function toggleCollapseState(foldingModel: FoldingModel, levels: number, lineNumbers: number[]) {
    const toToggle: FoldingRegion[] = [];
    for (const lineNumber of lineNumbers) {
        const region = foldingModel.getRegionAtLine(lineNumber);
        if (region) {
            const doCollapse = !region.isCollapsed;
            toToggle.push(region);
            if (levels > 1) {
                const regionsInside = foldingModel.getRegionsInside(
                    region,
                    (r, level: number) => r.isCollapsed !== doCollapse && level < levels
                );
                toToggle.push(...regionsInside);
            }
        }
    }
    foldingModel.toggleCollapseState(toToggle);
}
