import { formatJson, getFoldingRanges, doValidate, parseJsonAst } from '../service/jsonService';
import { JSONModel } from '../model/jsonModel';
import { FormattingOptions } from 'jsonc-parser';
import { createModel } from '../model';
import { IModelContentChangeEvent } from '../common/emitterEvents';

export class JsonWorker {
    private _model: JSONModel | null = null;

    constructor(value: string) {
        this._model = createModel(value);
    }

    getModel() {
        return this._model;
    }

    format(options: FormattingOptions) {
        if (!this._model) throw new Error('Model not initialized');
        return formatJson(this._model, options);
    }

    foldRange() {
        if (!this._model) throw new Error('Model not initialized');
        return getFoldingRanges(this._model);
    }

    validate() {
        if (!this._model) throw new Error('Model not initialized');
        return doValidate(this._model);
    }

    updateModel(op: IModelContentChangeEvent | IModelContentChangeEvent[]) {
        this._model?.applyOperation(op);
        return op;
    }

    undo() {
        this._model?.undo();
    }

    redo() {
        this._model?.redo();
    }

    parse() {
        if (!this._model) throw new Error('Model not initialized');
        return parseJsonAst(this._model);
    }
}
