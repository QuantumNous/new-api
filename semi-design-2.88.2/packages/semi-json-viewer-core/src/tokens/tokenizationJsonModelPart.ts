/** Based on https://github.com/microsoft/vscode with modifications for custom requirements */
import { JSONModel } from '../model/jsonModel';
import { JsonBackgroundTokenizer, JsonTokenizerWithStateStoreAndModel } from './jsonModelToken';
import { Token } from './tokenize';
import { createTokenizationSupport } from './tokenize';
import { GlobalEvents, IModelContentChangeEvent } from '../common/emitterEvents';
import { Emitter, getEmitter } from '../common/emitter';

export interface IBackgroundTokenizationStore {
    setTokens(lineNumber: number, tokens: Token[]): void

    // setEndState(lineNumber: number, state: JSONState): void;

    /**
     * Should be called to indicate that the background tokenization has finished for now.
     * (This triggers bracket pair colorization to re-parse the bracket pairs with token information)
     */
    // backgroundTokenizationFinished(): void;
}

export class TokenizationJsonModelPart {
    private readonly tokens: GrammarTokens;
    private _jsonModel: JSONModel | null = null;
    private emitter: Emitter<GlobalEvents> = getEmitter();
    constructor(jsonModel: JSONModel) {
        this._jsonModel = jsonModel;
        this.tokens = new GrammarTokens(this._jsonModel);
    }

    public getLineTokens(lineNumber: number): Token[] {
        return this.tokens.getLineTokens(lineNumber);
    }

    public handleDidChangeContent(e: IModelContentChangeEvent) {
        this.tokens.handleDidChangeContent(e);
    }

    public forceTokenize(lineNumber: number) {
        this.tokens.forceTokenize(lineNumber);
    }

    public requestTokens(range: { from: number; to: number }) {
        this.tokens.backgroundTokenizer?.requestTokens(range);
    }
}

export class GrammarTokens {
    private _tokens: Map<number, Token[]> = new Map();
    private _tokenizer: JsonTokenizerWithStateStoreAndModel | null = null;
    private _backgroundTokenizer: JsonBackgroundTokenizer | null = null;
    private _jsonModel: JSONModel;
    private emitter: Emitter<GlobalEvents> = getEmitter();
    constructor(jsonModel: JSONModel) {
        this._jsonModel = jsonModel;
        this.emitter.on('contentChanged', (e: IModelContentChangeEvent | IModelContentChangeEvent[]) => {
            let from = 0;
            let to = this._jsonModel.getLineCount();
            if (Array.isArray(e)) {
                from = e[e.length - 1].range.startLineNumber;
            } else {
                from = e.range.startLineNumber;
            }
            this._backgroundTokenizer?.requestTokens({
                from,
                to,
            });
            this._backgroundTokenizer?.handleChanges();
        });
        this.resetTokenization();
    }

    public get backgroundTokenizer() {
        return this._backgroundTokenizer;
    }

    public resetTokenization() {
        this._tokens.clear();
        const JsonTokenizationSupport = createTokenizationSupport(true);
        const initialState = JsonTokenizationSupport.getInitialState();
        if (JsonTokenizationSupport && initialState) {
            this._tokenizer = new JsonTokenizerWithStateStoreAndModel(
                this._jsonModel.getLineCount(),
                JsonTokenizationSupport,
                this._jsonModel
            );
        }

        const b: IBackgroundTokenizationStore = {
            setTokens: (lineNumber: number, tokens: Token[]) => {
                this._tokens.set(lineNumber, tokens);
            },
        };
        if (this._tokenizer) {
            this._backgroundTokenizer = new JsonBackgroundTokenizer(this._tokenizer, b);
            this._backgroundTokenizer.handleChanges();
        }
    }
    public getLineTokens(lineNumber: number): Token[] {
        return this._tokens.get(lineNumber) || [];
    }

    public handleDidChangeContent(e: IModelContentChangeEvent) {
        this._backgroundTokenizer?.handleChanges();
    }

    public forceTokenize(lineNumber: number) {
        const b: IBackgroundTokenizationStore = {
            setTokens: (lineNumber: number, tokens: Token[]) => {
                this._tokens.set(lineNumber, tokens);
            },
        };
        this._tokenizer?.updateTokensUntilLine(lineNumber, b);
    }
}
