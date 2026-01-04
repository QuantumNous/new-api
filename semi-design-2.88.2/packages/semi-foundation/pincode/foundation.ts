import BaseFoundation, { DefaultAdapter } from '../base/foundation';


export interface PinCodeBaseProps {
    disabled?: boolean;
    value?: string;
    format?: "number" | "mixed" | RegExp | ((value: string) => boolean);
    onChange: (value: string) => void;
    defaultValue?: string;
    count?: number;
    autoFocus?: boolean;
    onComplete?: (value: string) => void
}

export interface PinCodeBaseState {
    valueList: string[];
    currentActiveIndex: number
}

export interface PinCodeAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    onCurrentActiveIndexChange: (index: number) => Promise<void>|void;
    notifyValueChange: (values: string[]) => void;
    changeSpecificInputFocusState: (index: number, state: "blur" | "focus") => void;
    updateValueList: (newValueList: PinCodeBaseState['valueList']) => Promise<void>|void
}


class PinCodeFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<PinCodeAdapter<P, S>, P, S> {

    constructor(adapter: PinCodeAdapter<P, S>) {
        super({ ...adapter });
    }

    static numberReg = /^\d*$/;
    static mixedReg = /^[0-9a-zA-Z]$/;


    handleCurrentActiveIndexChange = (index: number, state: "focus"|"blur")=>{
        if (state === "focus") {
            this._adapter.onCurrentActiveIndexChange(index);
        }
    }

    completeSingleInput = async (i: number, singleInputValue: string) => {
        const isControlledComponent = this._isInProps("value");
        await this._adapter.onCurrentActiveIndexChange(i + 1);
        const valueList = [...this.getState("valueList")];
        valueList[i] = singleInputValue;
        this._adapter.notifyValueChange(valueList);
        if (!isControlledComponent) {
            await this.updateValueList(valueList);
        }

        const count = this.getProp('count');
        if (i + 1 > count - 1) {
            this._adapter.changeSpecificInputFocusState(i, "blur");
            this.getProp("onComplete")?.(valueList.join(""));
        } else {
            this._adapter.changeSpecificInputFocusState(i + 1, "focus");
        }

    }

    validateValue = (value: string = "") => {
        const format = this.getProp("format") as PinCodeBaseProps['format'];
        let validateFunction = (value: string) => true;
        if (typeof format === "string") {
            if (format === "number") {
                validateFunction = (value) => value.length === 0 || PinCodeFoundation.numberReg.test(value);
            } else if (format === "mixed") {
                validateFunction = (value: string) => value.length === 0 || PinCodeFoundation.mixedReg.test(value);
            }
        } else if (format instanceof RegExp) {
            validateFunction = (value: string) => (format as RegExp).test(value);
        } else if (typeof format === "function") {
            validateFunction = format;
        }
        return validateFunction(value);
    }

    updateValueList = async (newValueList: PinCodeBaseState['valueList']) => {
        this._adapter.updateValueList(newValueList);
    }

    handlePaste = async (e: ClipboardEvent, startInputIndex: number)=>{
        const textWillPaste = e.clipboardData.getData("text");
        const count = this.getProp("count");
        for (let i = startInputIndex, charIndex = 0;i < count && charIndex < textWillPaste.length;i++, charIndex++) {
            const currentChar = textWillPaste[charIndex];
            if (this.validateValue(currentChar)) {
                await this.completeSingleInput(i, currentChar);
            } else {
                break;
            }
        }
        e.preventDefault();
    }

    handleKeyDownOnSingleInput = (e: KeyboardEvent, index: number)=>{
        const valueList = [...this.getState("valueList")];
        if (e.key === "Backspace") {
            valueList[index] = "";
            this.updateValueList(valueList);
            this._adapter.notifyValueChange(valueList);
            this._adapter.changeSpecificInputFocusState(Math.max(0, index - 1), "focus");
            e.preventDefault();
        } else if (e.key === "Delete") {
            valueList[index] = "";
            this.updateValueList(valueList);
            this._adapter.notifyValueChange(valueList);
            this._adapter.changeSpecificInputFocusState(Math.min(valueList.length - 1, index + 1), "focus");
            e.preventDefault();
        } else if (e.key === "ArrowLeft") {
            this._adapter.changeSpecificInputFocusState(Math.max(0, index - 1), "focus");
            e.preventDefault();
        } else if (e.key === "ArrowRight") {
            this._adapter.changeSpecificInputFocusState(Math.min(valueList.length - 1, index + 1), "focus");
            e.preventDefault();
        }

    }


}


export default PinCodeFoundation;
