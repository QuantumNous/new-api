/* eslint-disable @typescript-eslint/ban-types */
import { DefaultAdapter } from '../base/foundation';
import { Options as ScrollIntoViewOptions } from 'scroll-into-view-if-needed';

export type BasicTriggerType = 'blur' | 'change' | 'custom' | 'mount';

export type FieldValidateTriggerType = BasicTriggerType | Array<BasicTriggerType>;

export type CommonFieldError = boolean | string | Array<any> | undefined | unknown;

export type BasicFieldError = Array<any>;

export interface BaseFormAdapter<P = Record<string, any>, S = Record<string, any>, Values extends object = any> extends DefaultAdapter<P, S> {
    cloneDeep: (val: any, ...rest: any[]) => any;
    notifySubmit: (values: any, e?: any) => void;
    notifySubmitFail: (errors: Record<keyof Values, BasicFieldError>, values: Partial<Values>, e?: any) => void;
    forceUpdate: (callback?: () => void) => void;
    notifyChange: (formState: FormState) => void;
    notifyValueChange: (values: any, changedValues: any) => void;
    notifyErrorChange: (errors: any, changedError: any) => void;
    notifyReset: () => void;
    getInitValues: () => Partial<Values>;
    getFormProps: (keys: undefined | string | Array<string>) => any;
    getAllErrorDOM: () => NodeList;
    getFieldDOM: (field: string) => Node;
    getFieldErrorDOM: (field: string) => Node;
    initFormId: () => void
}

export type AllErrors<T> = T extends Record<string, any> ? { [K in keyof T]?: string } : Record<string, any>;

export interface FormState<T extends Record<string, any> = any> {
    values?: T extends Record<string, any> ? T : Record<string, any>;
    errors?: AllErrors<T>;
    touched?: T extends Record<string, any> ? { [K in keyof T]?: boolean } : Record<string, any>
}
export interface setValuesConfig {
    isOverride: boolean
}

// FieldPath 类型定义，用于生成对象字段的路径字符串
export type FieldPath<T> = T extends object ? {
    // 遍历对象的每个键 K
    [K in keyof T]: T[K] extends object
        // 如果键 K 对应的值是对象，则生成嵌套路径（递归调用 FieldPath）
        ? `${string & K}.${FieldPath<T[K]>}` | `${string & K}`
        // 否则，仅生成当前键的路径
        : `${string & K}`;
}[keyof T]
    : never;

// FieldPathValue 类型定义，用于从路径字符串中推导出实际的类型
export type FieldPathValue<T, P extends FieldPath<T>> =
  // 如果路径字符串 P 包含嵌套路径（使用模板字符串类型进行匹配）
  P extends `${infer K}.${infer Rest}`
      ? K extends keyof T
          // 递归解析嵌套路径，逐层深入对象结构
          ? Rest extends FieldPath<T[K]>
              ? FieldPathValue<T[K], Rest>
              : never
          : never
      // 如果路径字符串 P 是顶层键
      : P extends keyof T
          ? T[P]
          : never;

export type ScrollToErrorOptions<K> = {
    field?: K;
    index?: number;
    scrollOpts?: ScrollIntoViewOptions
}

// use object replace Record<string, any>, fix issue 933
export interface BaseFormApi<T extends object = any> {
    /** get value of field */
    getValue: <P extends FieldPath<T>>(field?: P) => FieldPathValue<T, P>;
    /** set value of field */
    setValue: <K extends FieldPath<T>>(field: K, newFieldValue: any) => void;
    /** get error of field */
    getError: <K extends keyof T>(field: K) => any;
    /** set error of field */
    setError: <K extends keyof T>(field: K, fieldError: any) => void;
    /** get touched of field */
    getTouched: <K extends keyof T>(field: K) => boolean;
    /** set touch of field */
    setTouched: <K extends keyof T>(field: K, fieldTouch: boolean) => void;
    /** judge field exist */
    getFieldExist: <K extends keyof T>(field: K) => boolean;
    /** get formState of form */
    getFormState: () => FormState<T extends object ? T : object>;
    /** get formProps of form */
    getFormProps: (keys?: Array<string>) => ComponentProps;
    /** submit form manual */
    submitForm: () => void;
    /** reset form manual */
    reset: (fields?: Array<string>) => void;
    /** trigger validate  manual */
    validate: <K extends keyof T, Params extends Array<K>, V extends Params[number]>(fields?: Params) => Promise<{ [R in V]: T[R] }>;
    getInitValue: <K extends keyof T>(field: K) => any;
    getInitValues: () => any;
    getValues: () => T;
    /** set value of multiple fields */
    setValues: (fieldsValue: Partial<T>, config?: setValuesConfig) => void;
    scrollToField: <K extends keyof T>(field: K, scrollConfig?: ScrollIntoViewOptions) => void;
    scrollToError: <K extends keyof T>(config?: ScrollToErrorOptions<K>) => void
}

export interface CallOpts {
    [x: string]: any;
    notNotify?: boolean;
    notUpdate?: boolean;
    needClone?: boolean
}

export interface ComponentProps {
    [x: string]: any
}

export interface FieldState {
    value?: any;
    touched?: any;
    error?: any;
    status?: 'error' | 'success'
}

export interface WithFieldOption {
    valueKey?: string;
    onKeyChangeFnName?: string;
    valuePath?: string;
    maintainCursor?: boolean;
    shouldMemo?: boolean;
    shouldInject?: boolean
}

export interface InternalFieldApi {
    setValue: (val: any, opts: CallOpts) => void;
    setTouched: (isTouched: boolean, opts: CallOpts) => void;
    setError: (errors: any, opts: CallOpts) => void;
    reset: () => void;
    validate: (val: any, opts: CallOpts) => Promise<unknown>
}

export interface FieldStaff {
    field: string;
    fieldApi: InternalFieldApi;
    keepState: boolean;
    allowEmpty: boolean
}

export interface ArrayFieldStaff {
    field: string;
    updateKey?: string;
    initValue?: any
}
export interface FormUpdaterContextType {
    register: (field: string, fieldState: FieldState, fieldStuff: FieldStaff) => void;
    unRegister: (field: string) => void;
    updateStateValue: (field: string, value: any, opts?: CallOpts) => void;
    updateStateError: (field: string, error: any, opts?: CallOpts) => void;
    updateStateTouched: (field: string, isTouched: boolean, opts?: CallOpts) => void;
    getValue: (field?: string | undefined, opts?: CallOpts) => any;
    getError: (field?: string) => any;
    getTouched: (field?: string) => boolean | Record<string, any> | undefined;
    getInitValues: () => any;
    getInitValue: (field?: string) => any;
    getFormProps: (keys?: Array<string>) => ComponentProps;
    getField: (field: string) => FieldStaff | undefined;
    registerArrayField: (arrayFieldPath: string, val: any) => void;
    unRegisterArrayField: (arrayField: string) => void;
    getArrayField: (arrayField: string) => ArrayFieldStaff;
    updateArrayField: (arrayField: string, updateValue: any) => void
}

