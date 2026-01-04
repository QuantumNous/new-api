import BaseFoundation from '../base/foundation';
import * as ObjectUtil from '../utils/object';
import isPromise from '../utils/isPromise';
import { isValid } from './utils';
import { isUndefined, isFunction, toPath } from 'lodash';
import scrollIntoView, { Options as ScrollIntoViewOptions } from 'scroll-into-view-if-needed';

import { BaseFormAdapter, FormState, CallOpts, FieldState, FieldStaff, ComponentProps, setValuesConfig, ArrayFieldStaff } from './interface';

export type { BaseFormAdapter };

type ScrollToErrorOpts = {
    field?: string;
    index?: number;
    scrollOpts?: ScrollIntoViewOptions
}
export default class FormFoundation extends BaseFoundation<BaseFormAdapter> {

    data: FormState;
    fields: Map<string, FieldStaff>;
    registered: Record<string, boolean>;
    registeredArrayField: Map<string, ArrayFieldStaff>;

    constructor(adapter: BaseFormAdapter) {
        super({ ...adapter });
        /*
            Also need to read initValue here, because the Form level can set the initial value,
            and the Field level can also set the initial value.
            The field set in the Form does not necessarily have a Field entity,
            so you cannot completely rely on the register moment to set the initial value

            这里也需要读一次initValue，因为Form级别可设置初始值，Field级别也可设置初始值.
            Form中设置的字段，不一定会存在Field实体，所以不能完全依赖register时刻来设置初始值
        */
        let { initValues } = this._adapter.getProps();
        initValues = this._adapter.cloneDeep(initValues);

        this.data = {
            values: initValues ? initValues : {},
            errors: {},
            touched: {},
            // invalid: false,
            // dirty: false,
        };

        // Map store all fields
        // key: fieldName
        // value:  { field, fieldApi, keepState, initValue}
        this.fields = new Map();

        // Record all registered fields
        this.registered = {};

        // Record all registered ArrayField
        this.registeredArrayField = new Map();

        this.register = this.register.bind(this);
        this.unRegister = this.unRegister.bind(this);

        this.registerArrayField = this.registerArrayField.bind(this);
        this.unRegisterArrayField = this.unRegisterArrayField.bind(this);
        this.getArrayField = this.getArrayField.bind(this);
        this.updateArrayField = this.updateArrayField.bind(this);

        this.getField = this.getField.bind(this);
        this.setValues = this.setValues.bind(this);
        this.updateStateValue = this.updateStateValue.bind(this);
        this.updateStateError = this.updateStateError.bind(this);
        this.updateStateTouched = this.updateStateTouched.bind(this);

        this.getFormState = this.getFormState.bind(this);
        this.getValue = this.getValue.bind(this);
        this.getError = this.getError.bind(this);
        this.getTouched = this.getTouched.bind(this);
        this.getInitValues = this.getInitValues.bind(this);
        this.getInitValue = this.getInitValue.bind(this);
        this.getFormProps = this.getFormProps.bind(this);
        this.getFieldExist = this.getFieldExist.bind(this);
        this.scrollToField = this.scrollToField.bind(this);
        this.scrollToError = this.scrollToError.bind(this);
    }

    init() {
        this._adapter.initFormId();
    }

    getField(field: string): FieldStaff | undefined {
        const targetField = this.fields.get(field);
        return targetField;
    }

    register(field: string, fieldState: FieldState, fieldStuff: FieldStaff): void {
        // determine if this field has been register before
        const registered = this.registered[field];
        this.registered[field] = true;
        this.fields.set(field, fieldStuff);
        if (fieldStuff.keepState) {
            // TODO support keepState
        } else {
            const allowEmpty = fieldStuff.allowEmpty || false;
            const opts = {
                notNotify: true,
                notUpdate: false,
                allowEmpty,
            };
            let fieldValue = fieldState.value;
            // When allowEmpty is false, 'is equivalent to undefined, and the key of the field does not need to be reflected on values
            if (!allowEmpty && fieldValue === '') {
                fieldValue = undefined;
            }

            this.updateStateValue(field, fieldValue, opts);

            if (fieldState.error) {
                this.updateStateError(field, fieldState.error, opts);
            }
        }
        // this.log(this.fields);
    }

    unRegister(field: string): void {
        const targetField = this.fields.get(field);
        // delete data
        try {
            if (!targetField.keepState) {
                ObjectUtil.remove(this.data.values, field);
                ObjectUtil.remove(this.data.errors, field);
                ObjectUtil.remove(this.data.touched, field);
            }
        } catch (error) {
            console.error(`some thing wrong when unregister field:${field}`);
        }
        // delete field
        this.fields.delete(field);
        this._adapter.notifyChange(this.data);
        this._adapter.forceUpdate();
    }

    // in order to solve bytedance internal issue-289
    registerArrayField(arrayFieldPath: string, val: any): void {
        this.updateArrayField(arrayFieldPath, {
            updateKey: new Date().valueOf(),
            initValue: val
        });
    }

    unRegisterArrayField(arrayField: string): void {
        this.registeredArrayField.delete(arrayField);
    }

    getArrayField(arrayField: string): ArrayFieldStaff {
        return this.registeredArrayField.get(arrayField);
    }

    updateArrayField(arrayField: string, updateValue: any): void {
        const mergeVal = { ...this.registeredArrayField.get(arrayField), ...updateValue };
        this.registeredArrayField.set(arrayField, mergeVal);
    }

    validate(fieldPaths?: Array<string>): Promise<unknown> {
        const { validateFields } = this.getProps();
        if (validateFields && isFunction(validateFields)) {
            return this._formValidate();
        } else {
            return this._fieldsValidate(fieldPaths);
        }
    }

    // form level validate
    _formValidate(): Promise<unknown> {
        const { values } = this.data;
        const { validateFields } = this.getProps();

        return new Promise((resolve, reject) => {
            let maybePromisedErrors;
            try {
                maybePromisedErrors = validateFields(values);
            } catch (errors) {
                // error throw by sync validate directly
                maybePromisedErrors = errors;
            }
            if (!maybePromisedErrors) {
                const _values = this._adapter.cloneDeep(values);
                resolve(_values);
                this.injectErrorToField({});
            } else if (isPromise(maybePromisedErrors)) {
                maybePromisedErrors.then(
                    (result: any) => {
                        // validate success，clear error
                        if (!result) {
                            const _values = this._adapter.cloneDeep(values);
                            resolve(_values);
                            this.injectErrorToField({});
                        } else {
                            this.data.errors = result;
                            this._adapter.notifyChange(this.data);

                            this.injectErrorToField(result);
                            this._adapter.forceUpdate();
                            this._autoScroll(100);
                            reject(result);
                        }
                    },
                    (errors: any) => {
                        // validate failed
                        // this._adapter.notifyChange(this.data);
                        this._autoScroll(100);
                        reject(errors);
                    }
                );
            } else {
                // TODO: current design, returning an empty object will be considered a checksum failure and will be rejected. Only returning an empty string will be considered a success, consider resetting it in 1.0?
                this.data.errors = maybePromisedErrors;
                this.injectErrorToField(maybePromisedErrors);
                this._adapter.notifyChange(this.data);

                this._adapter.forceUpdate();
                this._autoScroll(100);
                reject(maybePromisedErrors);
            }
        });
    }

    // field level validate
    _fieldsValidate(fieldPaths: Array<string>): Promise<unknown> {
        const { values } = this.data;
        // When there is no custom validation function at Form level, perform validation of each Field
        return new Promise((resolve, reject) => {
            let promiseSet: Promise<any>[] = [];
            const targetFields = this._getOperateFieldMap(fieldPaths);
            targetFields.forEach((field, fieldPath) => {
                // Call each fieldApi for verification
                const fieldValue = this.getValue(fieldPath);
                // When centralized verification, no need to trigger forceUpdate and notify
                const opts = {
                    notNotify: true,
                    notUpdate: true,
                };
                const validateResult = field.fieldApi.validate(fieldValue, opts);
                promiseSet.push(validateResult);
                field.fieldApi.setTouched(true, opts);
            });
            Promise.all(promiseSet).then(() => {
                // After the centralized verification is completed, trigger notify and forceUpdate once.
                this._adapter.notifyChange(this.data);

                this._adapter.forceUpdate();
                const errors = this.getError();
                if (this._isValid(targetFields)) {
                    const _values = this._adapter.cloneDeep(values);
                    resolve(_values);
                } else {
                    this._autoScroll();
                    reject(errors);
                }
            });
        });
    }

    submit(e?: any): void {
        const { values } = this.data;
        // validate form
        this.validate()
            .then((resolveValues: any) => {
                // if valid do submit
                const _values = this._adapter.cloneDeep(resolveValues);
                this._adapter.notifySubmit(_values, e);
            })
            .catch(errors => {
                const _errors = this._adapter.cloneDeep(errors);
                const _values = this._adapter.cloneDeep(values);
                this._adapter.notifySubmitFail(_errors, _values, e);
            });
    }

    /**
     * Case A：
     *      All fields: a[0]、a[1]、b.type、b.name[2]、b.name[0]
     *      input => output:
     *           a  => a[0]、a[1]
     *           b  => b.type、b.name[0]、b.name[2]
     *
     * Case B：
     *      All fields: activity.a[0]、activity.a[1]、activity.c、activity.d、other
     *      input => output:
     *           activity.a => activity.a[0]、activity.a[1]
     *
     */
    _getNestedField(path: string): Map<string, FieldStaff> {
        const allRegisterField = this.fields;
        const allFieldPath = [...allRegisterField].map(item => item[0]);
        let nestedFieldPath = new Map();
        allFieldPath.forEach(item => {
            let itemPath = toPath(item);
            let targetPath = toPath(path);
            if (targetPath.every((path, i) => (targetPath[i] === itemPath[i]))) {
                const realField = allRegisterField.get(item);
                nestedFieldPath.set(item, realField);
            }
        });
        return nestedFieldPath;
    }

    // get all operate fields, called by validate() / reset()
    _getOperateFieldMap(fieldPaths?: Array<string>): Map<string, FieldStaff> {
        let targetFields = new Map();
        if (!isUndefined(fieldPaths)) {
            // reset or validate specific fields
            fieldPaths.forEach(path => {
                const field = this.fields.get(path);
                // may be undefined, if exists two fields like 'a[0]'、'a[1]', but user directly call reset(['a']) / validate(['a'])
                if (isUndefined(field)) {
                    const nestedFields = this._getNestedField(path);
                    targetFields = new Map([...targetFields, ...nestedFields]);
                } else {
                    targetFields.set(path, field);
                }
            });
        } else {
            // reset or validate all fields
            targetFields = this.fields;
        }
        return targetFields;
    }

    // Reset the entire form, reset all fields and remove validation results
    reset(fieldPaths?: Array<string>): void {
        const targetFields = this._getOperateFieldMap(fieldPaths);
        targetFields.forEach(field => {
            field.fieldApi.reset();
        });

        if (this.registeredArrayField.size) {
            this._resetArrayField();
        }

        this._adapter.notifyChange(this.data);
        this._adapter.forceUpdate();
        this._adapter.notifyReset();
    }

    _resetArrayField(): void {
        /*
            When Reset, arrayField needs to be processed separately. Restore the key/value of arrayField in formState according to the initial value
            Update the key inside the arrayField to make it actively renderer
            Reset时，arrayField需要单独处理, 根据初始值还原 arrayField在formState中的key/value, 更新 arrayField内部的key，使其主动rerender
        */
        const arrayFieldPaths = [...this.registeredArrayField.keys()];
        arrayFieldPaths.forEach(path => {
            const arrayFieldState = this.registeredArrayField.get(path);
            const arrayFieldInitValue = arrayFieldState.initValue;
            this.updateStateValue(path, arrayFieldInitValue, { notNotify: true, notUpdate: true });
            this.updateArrayField(path, { updateKey: new Date().valueOf() });
        });
    }

    // After calling the form's custom validateFields function, reject the returned error to the corresponding field
    // 调用了Form的自定义validateFields函数后，将返回的错误展示到对应的field中
    injectErrorToField(errors: any): void {
        this.fields.forEach(field => {
            const fieldError = ObjectUtil.get(errors, field.field);
            const opts = {
                notNotify: true,
                notUpdate: true,
            };
            field.fieldApi.setError(fieldError, opts);
        });
    }

    getValue(field: string | undefined, opts?: CallOpts): any {
        const isAllField = typeof field === 'undefined';
        const needClone = opts && opts.needClone;
        let result, fieldValue;
        switch (true) {
            case !isAllField && !needClone:
                result = ObjectUtil.get(this.data.values, field);
                break;
            case !isAllField && needClone:
                fieldValue = ObjectUtil.get(this.data.values, field);
                result = this._adapter.cloneDeep(fieldValue);
                break;
            case isAllField && !needClone:
                result = { ...this.data.values };
                break;
            case isAllField && needClone:
                result = this._adapter.cloneDeep(this.data.values);
                break;
            default:
                break;
        }
        return result;
    }

    setValues(values: any, { isOverride = false }): void {
        const _values = this._adapter.cloneDeep(values);
        this.fields.forEach(field => {
            const value = ObjectUtil.get(_values, field.field);
            // When calling setValues to override the values, only need to trigger onValueChange and onChange once, so setNotNotify of setValue to true
            // 调用setValues进行值的覆盖时，只需要回调一次onValueChange、onChange即可，所以此处将setValue的notNotify置为true
            const opts = {
                notNotify: true,
                notUpdate: true,
            };
            field.fieldApi.setValue(value, opts);
        });

        // if there exists any arrayField component in this form
        if (this.registeredArrayField.size) {
            const arrayFieldPaths = [...this.registeredArrayField.keys()];
            arrayFieldPaths.forEach(path => {
                this.updateArrayField(path, { updateKey: new Date().valueOf() });
            });
        }
        // When isOverride is true, there may be a non-existent field in the values passed in, directly synchronized to formState.values
        // 当isOverride为true，传入的values中可能存在不存在的field时，直接将其同步到formState.values中
        if (isOverride) {
            this.data.values = _values;
        }

        // After completing the assignment, the unified callback can be done once.
        // 在完成赋值后，统一回调一次即可
        this._adapter.notifyChange(this.data);
        this._adapter.notifyValueChange(this.data.values, { ...values });
        this._adapter.forceUpdate();
    }

    // update formState value
    updateStateValue(field: string, value: any, opts: CallOpts, callback?: () => void): void {
        const notNotify = opts && opts.notNotify;
        const notUpdate = opts && opts.notUpdate;
        const fieldAllowEmpty = opts && opts.fieldAllowEmpty;

        /**
         * 当Form.allowEmpty为true时，所有的field，key都会在formState.values中出现，如果值为空那么就是undefined
         * 当Form.allowEmpty为false时，只有有值的field，key才会在formState.values中出现
         * When F orm.allow Empty is true, all fields and keys will appear in the formS tate.values. If the value is empty, it is undefined
         * When F orm.allow Empty is false, only fields with values will key appear in the formS tate.values
         */

        const formAllowEmpty = this.getProp('allowEmpty');

        // priority at Field level
        const allowEmpty = fieldAllowEmpty ? fieldAllowEmpty : formAllowEmpty;

        ObjectUtil.set(this.data.values, field, value, allowEmpty);
        /**
         * When registering, setValue called when Field initValue is synchronized to FormState should not trigger notify
         * but need to trigger forceUpdate, otherwise useFormState, useFieldState initial rendering will have problems
         *
         * register时，Field中同步initValue到FormState时调用的setValue不应该触发notify
         * 但需要触发forceUpdate，否则useFormState、useFieldState初始渲染会有问题
         */

        if (!notNotify) {
            this._adapter.notifyChange(this.data);
            this._adapter.notifyValueChange(this.data.values, { [field]: value });
        }

        if (!notUpdate) {
            this._adapter.forceUpdate(callback);
        }
    }

    // get touched from formState
    getTouched(field?: string): boolean | Record<string, any> | undefined {
        if (typeof field === 'undefined') {
            return this.data.touched;
        }
        return ObjectUtil.get(this.data.touched, field);
    }

    // update formState touched
    updateStateTouched(field: string, isTouched: boolean, opts?: CallOpts, callback?: () => void): void {
        const notNotify = opts && opts.notNotify;
        const notUpdate = opts && opts.notUpdate;
        ObjectUtil.set(this.data.touched, field, isTouched);

        if (!notNotify) {
            this._adapter.notifyChange(this.data);
        }
        if (!notUpdate) {
            this._adapter.forceUpdate(callback);
        }
    }

    // get error from formState
    getError(field?: string): any {
        if (typeof field === 'undefined') {
            return this.data.errors;
        }
        return ObjectUtil.get(this.data.errors, field);
    }

    // update formState error
    updateStateError(field: string, error: any, opts: CallOpts, callback?: () => void): void {
        const notNotify = opts && opts.notNotify;
        const notUpdate = opts && opts.notUpdate;
        ObjectUtil.set(this.data.errors, field, error);

        
        // The setError caused by centralized validation does not need to trigger notify, otherwise it will be called too frequently, as many times as there are fields
        if (!notNotify) {
            this._adapter.notifyChange(this.data);
        }
        this._adapter.notifyErrorChange(this.data.errors, { [field]: error });
        
        if (!notUpdate) {
            this._adapter.forceUpdate(callback);
        }
    }

    // For internal use in the FormApi Operating Field
    getFieldSetterApi() {
        const setValue = (field: string, value: any, opts: CallOpts) => {
            const fieldApi = this.fields.get(field) ? this.fields.get(field).fieldApi : undefined;
            // DeepClone the value entered from the outside to avoid unexpected errors caused by not isolating the scope to the greatest extent. This setValue will be called in eg: ArrayField
            const newValue = this._adapter.cloneDeep(value);
            if (fieldApi) {
                // If there is a corresponding Field entity, call FieldApi to update the value
                fieldApi.setValue(newValue, opts);
            } else {
                // If you reset an entire array, such as Array Field, the array as a whole may actually have no Field entities (but each array element corresponds to a Field)
                // At this time, first modify formState directly, then find out the subordinate fields and drive them to update
                // Eg: peoples: [0, 2, 3]. Each value of the peoples array corresponds to an Input Field
                // When the user directly calls formA pi.set Value ('peoples', [2,3])
                this.updateStateValue(field, newValue, opts, () => {
                    let nestedFields = this._getNestedField(field);
                    if (nestedFields.size) {
                        nestedFields.forEach(fieldStaff => {
                            let fieldPath = fieldStaff.field;
                            let newFieldVal = ObjectUtil.get(this.data.values, fieldPath);
                            let nestedBatchUpdateOpts = { notNotify: true, notUpdate: true };
                            fieldStaff.fieldApi.setValue(newFieldVal, nestedBatchUpdateOpts);
                        });
                    }
                });

                // If the reset happens to be, then update the updateKey corresponding to ArrayField to render it again
                if (this.getArrayField(field)) {
                    this.updateArrayField(field, { updateKey: new Date().valueOf() });
                }
            }
        };
        const setError = (field: string, error: any, opts: CallOpts) => {
            const fieldApi = this.fields.get(field) ? this.fields.get(field).fieldApi : undefined;
            const newError = this._adapter.cloneDeep(error);
            if (fieldApi) {
                fieldApi.setError(newError, opts);
            } else {
                this.updateStateError(field, newError, opts, () => {
                    let nestedFields = this._getNestedField(field);
                    if (nestedFields.size) {
                        nestedFields.forEach(fieldStaff => {
                            let fieldPath = fieldStaff.field;
                            let newFieldError = ObjectUtil.get(this.data.errors, fieldPath);
                            let nestedBatchUpdateOpts = { notNotify: true, notUpdate: true };
                            fieldStaff.fieldApi.setError(newFieldError, nestedBatchUpdateOpts);
                        });
                    }
                });
                if (this.getArrayField(field)) {
                    this.updateArrayField(field, { updateKey: new Date().valueOf() });
                }
            }
        };
        const setTouched = (field: string, isTouched: boolean, opts: CallOpts) => {
            const fieldApi = this.fields.get(field) ? this.fields.get(field).fieldApi : undefined;
            // touched is boolean variable, no need to exec deepClone like setValue
            if (fieldApi) {
                fieldApi.setTouched(isTouched, opts);
            } else {
                this.updateStateTouched(field, isTouched, opts, () => {
                    let nestedFields = this._getNestedField(field);
                    if (nestedFields.size) {
                        nestedFields.forEach(fieldStaff => {
                            let fieldPath = fieldStaff.field;
                            let newFieldTouch = ObjectUtil.get(this.data.touched, fieldPath);
                            let nestedBatchUpdateOpts = { notNotify: true, notUpdate: true };
                            fieldStaff.fieldApi.setTouched(newFieldTouch, nestedBatchUpdateOpts);
                        });
                    }
                });
                if (this.getArrayField(field)) {
                    this.updateArrayField(field, { updateKey: new Date().valueOf() });
                }
            }
        };
        return {
            setValue,
            setError,
            setTouched,
        };
    }

    // For Field and ArrayField to read and modify FormState
    getModifyFormStateApi() {
        return {
            register: this.register,
            unRegister: this.unRegister,
            updateStateValue: this.updateStateValue,
            updateStateError: this.updateStateError,
            updateStateTouched: this.updateStateTouched,
            getValue: this.getValue,
            getError: this.getError,
            getTouched: this.getTouched,
            getInitValues: this.getInitValues,
            getInitValue: this.getInitValue,
            getFormProps: this.getFormProps,
            getField: this.getField,
            registerArrayField: this.registerArrayField,
            unRegisterArrayField: this.unRegisterArrayField,
            getArrayField: this.getArrayField,
            updateArrayField: this.updateArrayField,
        };
    }

    // Form APIs for external use, exposed to the user
    getFormApi() {
        const fieldSetterApi = this.getFieldSetterApi();
        return {
            ...fieldSetterApi,
            reset: (fields?: Array<string>) => this.reset(fields),
            validate: (fields?: Array<string>) => this.validate(fields),
            getValue: (field?: string) => this.getValue(field, { needClone: true }),
            getValues: () => this.getValue(undefined, { needClone: true }),
            getFormState: () => this.getFormState(true),
            getFormProps: (props?: Array<string>) => this.getFormProps(props),
            getInitValue: (field: string) => this.getInitValue(field),
            getInitValues: () => this.getInitValues(),
            getTouched: (field?: string) => this.getTouched(field),
            getError: (field?: string) => this.getError(field),
            setValues: (values: any, opts?: setValuesConfig) => this.setValues(values, opts || { isOverride: false }),
            submitForm: () => this.submit(),
            getFieldExist: (field: string) => this.getFieldExist(field),
            scrollToField: (field: string, scrollOpts?: ScrollIntoViewOptions) => this.scrollToField(field, scrollOpts),
            scrollToError: (opts?: ScrollToErrorOpts) => this.scrollToError(opts),
        };
    }

    getFormState(needClone = false): FormState {
        // NOTES：这里如果直接返回this.data，forceUpdate 触发 Form rerender 时，通过context传下去的formState会被认为是同一个对象【应该是浅对比的原因】
        // 使用了useFormState相关的component都不会触发重新渲染。所以使用...复制一次

        /*
            The reason for distinguishing deepClone: When semi is calling getFormState for internal consumption,
            the value of formState will not be modified, so deep cloning is not necessary, which can reduce performance loss
            But if the users use formApi.getFormState(), the behavior is unpredictable, and invasive modifications may be performed,
            so deep clones are used for isolation.
            对deepClone进行区分的原因：semi调用getFormState内部消费时，不会对formState的值进行修改，所以无需深克隆，节约开销
            但如果是业务方用formApi调用getFormState时，行为无法预料，有可能会进行侵入式修改，所以用深克隆进行隔离
        */
        if (!needClone) {
            return {
                ...this.data,
            };
        } else {
            return this._adapter.cloneDeep(this.data);
        }
    }

    _isValid(targetFields: Map<string, FieldStaff>): boolean {
        let valid = true;
        if (!targetFields) {
            valid = Boolean(ObjectUtil.empty(this.data.errors));
        } else {
            // when trigger partial validate
            const targetFieldStr = [...targetFields.keys()];
            targetFieldStr.forEach(fieldStr => {
                const fieldError = ObjectUtil.get(this.data.errors, fieldStr);
                if (!isValid(fieldError)) {
                    valid = false;
                }
            });
        }
        return valid;
    }

    // get form.props.initValues
    getInitValues(): any {
        return this._adapter.getInitValues();
    }

    getInitValue(field?: string): any {
        if (typeof field === 'undefined') {
            return this._adapter.getInitValues();
        }
        return ObjectUtil.get(this._adapter.getInitValues(), field);
    }

    getFormProps(keys?: Array<string>): ComponentProps {
        return this._adapter.getFormProps(keys);
    }

    getFieldExist(field: string): boolean {
        return Boolean(this.fields.has(field));
    }

    _autoScroll(timeout?: boolean | number): void {
        const { autoScrollToError } = this.getFormProps();
        if (!autoScrollToError) {
            return;
        }
        let scrollOpts = { behavior: 'smooth' as const, block: 'start' as const };
        typeof autoScrollToError === 'object' ? (scrollOpts = autoScrollToError) : null;
        if (timeout) {
            setTimeout(() => this._getErrorFieldAndScroll(scrollOpts), 100);
        } else {
            this._getErrorFieldAndScroll(scrollOpts);
        }
    }

    _getErrorFieldAndScroll(scrollOpts?: ScrollIntoViewOptions | boolean): void {
        const errorDOM = this._adapter.getAllErrorDOM();
        if (errorDOM && errorDOM.length) {
            try {
                const fieldDOM = errorDOM[0].parentNode.parentNode;
                scrollIntoView(fieldDOM as Element, scrollOpts);
            } catch (error) {}
        }
    }

    scrollToField(field: string, scrollOpts = { behavior: 'smooth', block: 'start' } as ScrollIntoViewOptions): void {
        if (this.getFieldExist(field)) {
            const fieldDOM = this._adapter.getFieldDOM(field);
            scrollIntoView(fieldDOM as Element, scrollOpts);
        }
    }

    scrollToError(config?: ScrollToErrorOpts): void { 
        let scrollOpts: ScrollIntoViewOptions = config && config.scrollOpts ? config.scrollOpts : { behavior: 'smooth', block: 'start' };
        let field = config && config.field;
        let index = config && config.index;
        let fieldDOM, errorDOM;
        if (typeof index === 'number') {
            const allErrorDOM = this._adapter.getAllErrorDOM();
            let errorDOM = allErrorDOM[index];
            if (errorDOM) {
                fieldDOM = errorDOM.parentNode.parentNode;
            }
        } else if (field) {
            // If field is specified, find the error dom of the corresponding field
            errorDOM = this._adapter.getFieldErrorDOM(field);
            if (errorDOM) {
                fieldDOM = errorDOM.parentNode.parentNode;
            }
        } else if (typeof field === 'undefined') {
            // If field is not specified, find all error doms and scroll to the first one
            let allErrorDOM = this._adapter.getAllErrorDOM();
            if (allErrorDOM && allErrorDOM.length) {
                fieldDOM = allErrorDOM[0].parentNode.parentNode;
            }
        }

        if (fieldDOM) {
            scrollIntoView(fieldDOM as Element, scrollOpts);
        }
    }
}
