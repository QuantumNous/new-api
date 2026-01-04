/** reference from https://github.com/microsoft/vscode */
import { JSONModel } from '../model/jsonModel';
import { JSONState, JsonTokenizationSupport } from './tokenize';
import { OffsetRange } from './offsetRange';
import { runWhenGlobalIdle } from '../common/async';
import { IBackgroundTokenizationStore } from './tokenizationJsonModelPart';
import { StopWatch } from '../common/stopWatch';

export class TokenizerWithStateStore {
    private readonly initialState: JSONState;
    public readonly store: TrackingTokenizationStateStore;
    constructor(lineCount: number, public readonly tokenizationSupport: JsonTokenizationSupport) {
        this.initialState = tokenizationSupport.getInitialState();
        this.store = new TrackingTokenizationStateStore(lineCount);
    }

    public getStartState(lineNumber: number): JSONState {
        return this.store.getStartState(lineNumber, this.initialState);
    }

    public getFirstInvalidLine(): {
        lineNumber: number;
        startState: JSONState
    } | null {
        return this.store.getFirstInvalidLine(this.initialState);
    }
}

export class JsonTokenizerWithStateStoreAndModel extends TokenizerWithStateStore {
    constructor(
        lineCount: number,
        tokenizationSupport: JsonTokenizationSupport,
        public readonly _jsonModel: JSONModel
    ) {
        super(lineCount, tokenizationSupport);
    }

    public updateTokensUntilLine(lineNumber: number, backgroundTokenizationStore: IBackgroundTokenizationStore): void {
        while (true) {
            const lineToTokenize = this.getFirstInvalidLine();

            if (!lineToTokenize || lineToTokenize.lineNumber > lineNumber) {
                break;
            }

            const text = this._jsonModel.getLineContent(lineToTokenize.lineNumber);
            const result = this.tokenizationSupport.tokenize(text, lineToTokenize.startState);
            backgroundTokenizationStore.setTokens(lineToTokenize.lineNumber, result.tokens);

            this.store.setEndState(lineToTokenize.lineNumber, result.endState);
        }
    }
}

export class TrackingTokenizationStateStore {
    private readonly _tokenizationStateStore = new TokenizationStateStore();
    private readonly _invalidatedLines = new RangePriorityQueue();
    constructor(private lineCount: number) {
        this._invalidatedLines.addRange(new OffsetRange(1, lineCount + 1));
    }

    public getEndState(lineNumber: number): JSONState {
        return this._tokenizationStateStore.getEndState(lineNumber);
    }

    public setEndState(lineNumber: number, state: JSONState): boolean {
        this._invalidatedLines.delete(lineNumber);
        const result = this._tokenizationStateStore.setEndState(lineNumber, state);
        if (result && lineNumber < this.lineCount) {
            this._invalidatedLines.addRange(new OffsetRange(lineNumber + 1, lineNumber + 2));
        }
        return result;
    }

    public getStartState(lineNumber: number, initialState: JSONState): JSONState {
        if (lineNumber === 1) {
            return initialState;
        }
        return this.getEndState(lineNumber - 1);
    }

    public getFirstInvalidEndStateLineNumber(): number | null {
        return this._invalidatedLines.min;
    }

    public getFirstInvalidLine(
        initialState: JSONState
    ): {
            lineNumber: number;
            startState: JSONState
        } | null {
        const lineNumber = this.getFirstInvalidEndStateLineNumber();
        if (lineNumber === null) {
            return null;
        }
        const startState = this.getStartState(lineNumber, initialState);
        if (!startState) {
            throw new Error('Start state must be defined');
        }
        return {
            lineNumber,
            startState: this.getStartState(lineNumber, initialState),
        };
    }

    public allStatesValid(): boolean {
        return this._invalidatedLines.min === null;
    }

    public invalidateRange({ from, to }: { from: number; to: number }): void {
        this._invalidatedLines.addRange(new OffsetRange(from, to));
    }
}

export class TokenizationStateStore {
    private readonly _lineEndState = new Array<JSONState>();

    public getEndState(lineNumber: number): JSONState {
        return this._lineEndState[lineNumber];
    }

    public setEndState(lineNumber: number, state: JSONState): boolean {
        const oldState = this._lineEndState[lineNumber];
        if (oldState && oldState.equals(state)) {
            return false;
        }
        this._lineEndState[lineNumber] = state;
        return true;
    }
}

export class RangePriorityQueue {
    private readonly _ranges: OffsetRange[] = [];

    public getRange(): OffsetRange[] {
        return this._ranges;
    }

    public addRange(range: OffsetRange): void {
        OffsetRange.addRange(range, this._ranges);
    }

    public get min(): number | null {
        return this._ranges[0]?.start ?? null;
    }
    /**
     * 现有的范围集合中添加一个新的范围
     * @param range
     * @param newLength
     */
    public addRangeAndResize(range: OffsetRange, newLength: number): void {
        // 找到第一个可能与新范围相交的范围
        let idxFirstMightBeIntersecting = 0;
        while (
            !(
                idxFirstMightBeIntersecting >= this._ranges.length ||
                range.start <= this._ranges[idxFirstMightBeIntersecting].endExclusive
            )
        ) {
            idxFirstMightBeIntersecting++;
        }
        // 找到第一个在新范围之后，且与新范围不相交的范围
        let idxFirstIsAfter = idxFirstMightBeIntersecting;
        while (!(idxFirstIsAfter >= this._ranges.length || range.endExclusive < this._ranges[idxFirstIsAfter].start)) {
            idxFirstIsAfter++;
        }
        // 计算新范围与旧范围的差值
        const delta = newLength - range.length;
        // 将所有在新范围之后的范围进行调整

        for (let i = idxFirstIsAfter; i < this._ranges.length; i++) {
            this._ranges[i] = this._ranges[i].delta(delta);
        }

        if (idxFirstMightBeIntersecting === idxFirstIsAfter) {
            const newRange = new OffsetRange(range.start, range.start + newLength);
            if (!newRange.isEmpty) {
                this._ranges.splice(idxFirstMightBeIntersecting, 0, newRange);
            }
        } else {
            const start = Math.min(range.start, this._ranges[idxFirstMightBeIntersecting].start);
            const endEx = Math.max(range.endExclusive, this._ranges[idxFirstIsAfter - 1].endExclusive);
            // 创建一个新的范围，并将其添加到范围集合中
            const newRange = new OffsetRange(start, endEx + delta);
            if (!newRange.isEmpty) {
                this._ranges.splice(
                    idxFirstMightBeIntersecting,
                    idxFirstIsAfter - idxFirstMightBeIntersecting,
                    newRange
                );
            } else {
                this._ranges.splice(idxFirstMightBeIntersecting, idxFirstIsAfter - idxFirstMightBeIntersecting);
            }
        }
    }
    /**
     * 删除一个值
     * @param value
     */
    public delete(value: number): void {
        // 找到第一个包含该值的范围
        const idx = this._ranges.findIndex(r => r.contains(value));
        if (idx !== -1) {
            const range = this._ranges[idx];
            // 如果该值正好是范围的开始
            if (range.start === value) {
                //如果范围长度为1，直接删除整个范围。
                //否则，将范围的起始点向后移动一位。
                if (range.endExclusive === value + 1) {
                    this._ranges.splice(idx, 1);
                } else {
                    this._ranges[idx] = new OffsetRange(value + 1, range.endExclusive);
                }
            } else {
                // 如果该值在范围的中间
                // 如果该值正好是范围的结束
                if (range.endExclusive === value + 1) {
                    this._ranges[idx] = new OffsetRange(range.start, value);
                } else {
                    // 否则，将范围分成两个范围
                    this._ranges.splice(
                        idx,
                        1,
                        new OffsetRange(range.start, value),
                        new OffsetRange(value + 1, range.endExclusive)
                    );
                }
            }
        }
    }
}

export class JsonBackgroundTokenizer {
    constructor(
        private readonly _jsonTokenizerWithStateStoreAndModel: JsonTokenizerWithStateStoreAndModel,
        private readonly _backgroundTokenizationStore: IBackgroundTokenizationStore
    ) {}

    public handleChanges(): void {
        this._beginBackgroundTokenization();
    }

    private _beginBackgroundTokenization(): void {
        runWhenGlobalIdle((deadline: IdleDeadline) => {
            this._backgroundTokenizeWithDeadline(deadline);
        });
    }

    private _backgroundTokenizeWithDeadline(deadline: IdleDeadline): void {
        const endTime = Date.now() + deadline.timeRemaining();

        const execute = () => {
            if (!this._hasLinesToTokenize()) return;
            this._backgroundTokenize();

            if (Date.now() < endTime) {
                setTimeout(execute);
            } else {
                this._beginBackgroundTokenization();
            }
        };
        execute();
    }

    private _backgroundTokenize(): void {
        const lineCount = this._jsonTokenizerWithStateStoreAndModel._jsonModel.getLineCount();
        const stopWatch = StopWatch.create(true);
        do {
            if (stopWatch.elapsed() > 1) {
                break;
            }
            const tokenizedNumber = this._tokenizeOneInvalidLine();
            if (tokenizedNumber > lineCount) {
                break;
            }
        } while (this._hasLinesToTokenize());
    }

    private _hasLinesToTokenize(): boolean {
        if (!this._jsonTokenizerWithStateStoreAndModel) {
            return false;
        }
        return !this._jsonTokenizerWithStateStoreAndModel.store.allStatesValid();
    }

    private _tokenizeOneInvalidLine(): number {
        const firstInvalidLine = this._jsonTokenizerWithStateStoreAndModel.getFirstInvalidLine();

        if (!firstInvalidLine) {
            return this._jsonTokenizerWithStateStoreAndModel._jsonModel.getLineCount() + 1;
        }
        //TODO builder
        this._jsonTokenizerWithStateStoreAndModel.updateTokensUntilLine(
            firstInvalidLine.lineNumber,
            this._backgroundTokenizationStore
        );
        return firstInvalidLine.lineNumber;
    }

    public requestTokens({ from, to }: { from: number; to: number }): void {
        this._jsonTokenizerWithStateStoreAndModel.store.invalidateRange({
            from: from === 1 ? 1 : from - 1,
            to: to + 1,
        });
    }
}
