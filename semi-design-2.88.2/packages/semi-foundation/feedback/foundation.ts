import isPromise from '../utils/isPromise';
import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { omit } from 'lodash';

export interface FeedbackAdapter extends Partial<DefaultAdapter> {
    notifyClose(): void;
    setValue(value: any): void;
    notifyValueChange(value: any): void;
    notifyCancel: (e: any) => void | Promise<any>;
    notifyOk: (e: any) => void | Promise<any>;
    notifyTextAreaChange: (value: string, e: any) => void;
    notifyCheckBoxChange: (value: any[]) => void;
    notifyRadioChange: (e: any) => void
}

export default class FoundationFoundation extends BaseFoundation<FeedbackAdapter> {
    
    constructor(adapter: FeedbackAdapter) {
        super({ ...adapter });
    }

    handleRadioChange = (e: any) => {
        const { value } = e.target;
        this._adapter.notifyRadioChange(e);
        this._adapter.notifyValueChange(value);
    }

    handleEmojiReasonChange = (value: string, e?: React.MouseEvent<HTMLTextAreaElement>) => {
        this._adapter.notifyTextAreaChange(value, e);
        const oldValue = this._adapter.getState('value');
        const newValue = {
            ...oldValue,
            text: value,
        };
        this._adapter.notifyValueChange(newValue);
    }

    handleTextChange = (value: string, e?: React.MouseEvent<HTMLTextAreaElement>) => {
        this._adapter.notifyTextAreaChange(value, e);
        this._adapter.notifyValueChange(value);
    }

    handleEmojiClick = (e: React.MouseEvent<HTMLSpanElement>) => {
        const { value } = e.currentTarget.dataset;
        this._adapter.notifyValueChange({
            emoji: value,
        });
    }

    handleCheckboxChange = (value: string[]) => {
        this._adapter.notifyCheckBoxChange(value);
        this._adapter.notifyValueChange(value);
    }

    handleCancel = (e: React.MouseEvent<Element> | React.KeyboardEvent<Element>) => {
        const result = this._adapter.notifyCancel(e as any);
        if (isPromise(result)) {
            this._adapter.setState({ onCancelReturnPromiseStatus: "pending" });
            (result as Promise<any>)?.then(() => {
                this._adapter.setState({ 
                    onCancelReturnPromiseStatus: "fulfilled", 
                    value: null
                });
            })?.catch(e => {
                this._adapter.setState({ onCancelReturnPromiseStatus: "rejected" });
                throw e;
            });
        } else {
            this._adapter.setValue(null);
        }
    }

    handleSubmit = (e: React.MouseEvent<Element>) => {
        const result = this._adapter.notifyOk(e);
        if (isPromise(result)) {
            this._adapter.setState({ onOKReturnPromiseStatus: "pending" });
            (result as Promise<any>)?.then(() => {
                this._adapter.setState({ 
                    onOKReturnPromiseStatus: "fulfilled",
                    value: null
                });
            })?.catch(e => {
                this._adapter.setState({ onOKReturnPromiseStatus: "rejected" });
                throw e;
            });
        } else {
            this._adapter.setValue(null);
        }
    }

    handleModalOk = (e: React.MouseEvent<Element>) => {
        const result = this._adapter.notifyOk(e);
        if (isPromise(result)) {
            return (result as Promise<any>)?.then(() => {
                this._adapter.setState({ value: null });
                return Promise.resolve();
            });
        } else {
            this._adapter.setValue(null);
            return null;
        }
    }

    handleModalCancel = (e: React.MouseEvent<Element>) => {
        const result = this._adapter.notifyCancel(e as any);
        if (isPromise(result)) {
            return (result as Promise<any>)?.then(() => {
                this._adapter.setState({ value: null });
                return Promise.resolve();
            });
        } else {
            this._adapter.setState({ value: null });
            return null;
        }
    }

    disableSubmitButton = () => {
        const value = this.getState('value');
        return !Boolean(value) || (Array.isArray(value) && value.length === 0);
    }

    getRestProps = () => {
        const { className, children, type, mode, ...rest } = this._adapter.getProps();
        let omitPropsName = [ 'mode', 'type', 'onValueChange', 
            'textAreaProps', 'radioGroupProps', 'checkboxGroupProps', 'renderContent', 'onCancel', 'onOk'];
        if (mode === 'popup') {
            omitPropsName = omitPropsName.concat(['okButtonProps', 'cancelButtonProps']);
        }
        const restProps = omit(rest, omitPropsName);
        return restProps;
    }

}