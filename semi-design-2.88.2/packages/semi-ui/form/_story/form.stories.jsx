import React, { useState, useLayoutEffect, useEffect, useRef } from 'react';
import {
  Form,
  Button,
} from '../../index';
import { BasicDemoWithInit, LinkFieldForm, DifferentDeclareUsage } from './demo';


// layout
import { LayoutDemo, InsetLabelDemo } from './Layout/layoutDemo';
import { AssistComponent } from './Layout/slotDemo';
import { ModalFormDemo } from './Layout/modalFormDemo';

// hooks + HOC
import {
  UseFormApiDemo,
  UseFormStateDemo,
  UseFieldApiDemo,
  UseFieldStateDemo,
  WithFormStateDemo,
  WithFormApiDemo,
  ComponentUsingFormState,
  CustomStringify,
} from './Hook/hookDemo';
import { WithFieldDemo, CustomFieldDemo, NumberRange } from './HOC/withFieldDemo';

// validate
import {
  CustomValidateDemo,
  ValidateFieldsDemo,
  PartValidAndResetDemo,
  RulesValidateDemo,
  SetBugDemo,
  UnmountedLeafDemo,
  RulesExample,
  RaceAsyncDemo,
} from './Validate/validateDemo';
import { TriggerDemo } from './Validate/TriggerAndStopValidateWithError';
import UnmountValidateDemo from './Validate/validateWithUnmount';

// field props
import { ConvertDemo } from './FieldProps/convert';
import { NameDemo } from './FieldProps/name';
import { HelpAndExtra, ExtraPositionDemo } from './FieldProps/helpAndExtra';
import { BigNumberFieldDemo } from './FieldProps/bigNumberFieldPath';
import { UpdateDemo, RuleupdateDemo } from './FieldProps/rulesUpdateDemo';
import { FieldRefDemo } from './FieldProps/fieldRef';
import { LableOptionalDemo } from './FieldProps/labelOptional';

// form inputGroup
import { InputGroupDemo } from './InputGroup/groupProps';

// arrayField
import {
  ArrayFieldCollapseDemo,
  ArrayFieldDemo,
  ArrayFieldWithFormInitValues,
  ArrayFieldWithInitValue,
  ArrayFieldSetValues,
} from './DynamicField/arrayFieldDemo';
import { NestArrayField } from './DynamicField/nestArrayField';
import { ArrayDemo } from './FormApi/arrayDemo';

// performance
import {
  ManyFieldDemo,
  EffectDemo,
  ModalFormSelectWithObject,
} from './Performance/performanceDemo';
import { SetValuesDemo, SetValuesWithArrayField } from './FormApi/setValuesDemo';
import { SetValueUsingParentPath } from './FormApi/formApiDemo';
import { ScrollToErrorDemo } from './FormApi/scrollToError';
import { FieldPathWithArrayDemo } from './Debug/bugDemo';
import ChildDidMount from './Debug/childDidMount';

export { default as FormSubmit } from './FormSubmit';
export { default as TabelForm } from './TableDemo';
export { default as RemountInit } from './ArrayField/remountInit'
export { default as MountAndAddLine} from './ArrayField/mountAndAdd';

export const ScrollToError = () => <ScrollToErrorDemo></ScrollToErrorDemo>
// export { default as ScrollToError } from './FormApi/scrollToError'

const {
  Input,
  Select,
  DatePicker,
  Switch,
  Slider,
  CheckboxGroup,
  Checkbox,
  RadioGroup,
  Radio,
  TimePicker,
} = Form;

export default {
  title: 'Form'
}

const Option = Select.Option;

export const FormDeclareUsage = () => <DifferentDeclareUsage />;
export const BasicDemo = () => <BasicDemoWithInit />;

// Layout-Form wrapperCol/labelCol
// Layout-insetLabel
// Layout-label show optional
// Layout-Slot/ErrorMessage/Label
// Layout- ModalDemo
export const LayoutFormWrapperColLabelCol = () => <LayoutDemo />;
export const LayoutInsetLabel = () => <InsetLabelDemo />;
export const LableOptional = () => <LableOptionalDemo></LableOptionalDemo>;
export const LayoutSlotErrorMessageLabel = () => <AssistComponent />;
export const LayoutModalDemo = () => <ModalFormDemo />;

// formApi-setValues(override)
// formApi-validate
// formApi-setValue using field parent path
// formApi-setValue set array
export const FormApiSetValuesOverride = () => <SetValuesDemo />;
export const FormApiValidate = () => <PartValidAndResetDemo />;
export const FormApiSetValueUsingFieldParentPath = () => <SetValueUsingParentPath />;
export const UseFormApiSetValueUpdateArray = () => <ArrayDemo />;

// Dynamic Add / Remove Field
export const DynamicAddRemoveField = () => (
  <Form>
    {({ formState }) => (
      <React.Fragment>
        <Input field="name" label="First name:" />
        <RadioGroup field="married" label="Are you married?">
          <Radio value="yes">yes</Radio>
          <Radio value="no">no</Radio>
        </RadioGroup>
        {formState.values.married === 'yes' ? <Input field="spouse" label="Spouse name:" /> : null}
        <Button htmlType="submit">Submit</Button>
        <ComponentUsingFormState />
      </React.Fragment>
    )}
  </Form>
);


// ArrayField-basic usage
// ArrayField-with form initValues
// ArrayField-with arrayField initValue
// ArrayField-setValues didMount
// ArrayField-Nest Usage
// ArrayField-CollapseDemo
export const ArrayFieldBasicUsage = () => <ArrayFieldDemo />;
export const _ArrayFieldWithFormInitValues = () => <ArrayFieldWithFormInitValues />;
export const ArrayFieldWithArrayFieldInitValue = () => <ArrayFieldWithInitValue />;
export const ArrayFieldSetValuesDemo = () => <ArrayFieldSetValues />;
export const ArrayFieldNestUsage = () => <NestArrayField />;
export const _ArrayFieldCollapseDemo = () => <ArrayFieldCollapseDemo />;


export const LinkField = () => <LinkFieldForm />;

// Valdiate-FormLevel
// Validate-FieldLevel
// Validate-FieldLevel-use rules
// Validate-FieldLevel-race async
export const ValidateFormLevel = () => <ValidateFieldsDemo />;
export const ValidateFieldLevel = () => <CustomValidateDemo />;
export const ValidateUseRules = () => <RulesValidateDemo />;
export const RaceAsync = () => <RaceAsyncDemo />;
export const UnmountValidate = () => <UnmountValidateDemo />;

export const Trigger = () => <TriggerDemo></TriggerDemo>;

// Hooks-useFormApi
// Hooks-useFormState
// Hooks-useFormState
// Hooks-useFieldApi
// Hooks-useFieldState
// Hooks-withFormApi
// Hooks-withFormState
// withField
// 
export const HooksUseFormApi = () => <UseFormApiDemo />;
export const HooksUseFormState = () => <UseFormStateDemo />;
export const HooksUseFieldApi = () => <UseFieldApiDemo />;
export const HooksUseFieldState = () => <UseFieldStateDemo />;
export const HocWithFormApi = () => <WithFormApiDemo />;
export const HocWithFormState = () => <WithFormStateDemo />;
export const WithField = () => <CustomFieldDemo />;
export const WithFieldWithStatefulComponent = () => <WithFieldDemo />;
export const WithFieldNumberRange = () => (
  <Form onChange={v => console.log(v)}>
    <NumberRange field="number" initValue={[1, 2]} noLabel={true}></NumberRange>
  </Form>
);

WithFieldNumberRange.story = {
  name: 'withField - NumberRange',
};

export const PerformanceManyField = () => <ManyFieldDemo />;

PerformanceManyField.story = {
  name: 'Performance-ManyField',
};

export const PerformanceModalFormSelectWithObject = () => <ModalFormSelectWithObject />;

PerformanceModalFormSelectWithObject.story = {
  name: 'Performance-ModalFormSelectWithObject',
};

export const FiledPropConvert = () => <ConvertDemo />;

FiledPropConvert.story = {
  name: 'Filed Prop-convert',
};

export const FieldPropsName = () => <NameDemo />;

FieldPropsName.story = {
  name: 'Filed Prop-name',
};

export const FiledPropHelpTextExtraTextExtraTextPosition = () => (
  <>
    <HelpAndExtra />
    <ExtraPositionDemo />
  </>
);

FiledPropHelpTextExtraTextExtraTextPosition.story = {
  name: 'Filed Prop-helpText / extraText / extraTextPosition',
};

export const FieldPropsDynamicUpdateRulesRequired = () => <RuleupdateDemo />;

FieldPropsDynamicUpdateRulesRequired.story = {
  name: 'Field Props-dynamic update rules.required',
};

export const FieldPropInitValue = () => <InitEmptyStringDemo />;

FieldPropInitValue.story = {
  name: 'Field Prop-initValue=""',
};

export const FieldPropBigNumberFieldSubmit = () => <BigNumberFieldDemo />;

FieldPropBigNumberFieldSubmit.story = {
  name: 'Field prop-big number field submit',
};

export const FieldPropPure = () => (
  <Form>
    <Form.Select
      field="name"
      pure
      className="fefefe"
      fieldClassName="feichang"
      style={{ width: 400 }}
    />
  </Form>
);

FieldPropPure.story = {
  name: 'Field Prop-pure',
};

export const FieldPropRef = () => <FieldRefDemo />;

FieldPropRef.story = {
  name: 'Field Prop-ref',
};


export const GroupProp = () => <InputGroupDemo />

GroupProp.story = {
  name: 'InputGroup Prop - basic'
};


const InitEmptyStringDemo = () => {
  return (
    <Form allowEmpty>
      <Form.Input field="name" initValue="" />
      <ComponentUsingFormState />
    </Form>
  );
};

export const DebugSetBugDemo = () => (
  <>
    <SetBugDemo />
    <UnmountedLeafDemo />
  </>
);

DebugSetBugDemo.story = {
  name: 'Debug-SetBugDemo',
};

export const DebugSetValuesWithArrayField = () => (
  <>
    <SetValuesWithArrayField />
  </>
);

DebugSetValuesWithArrayField.story = {
  name: 'Debug-SetValuesWithArrayField',
};

import { SetValuesArray, DoubleRerender } from './Debug/bugDemo';

export const DebugArrayFieldPath = () => <FieldPathWithArrayDemo />;

DebugArrayFieldPath.story = {
  name: 'Debug-数组类fieldPath',
};

export const DebugSetValuesDemo = () => (
  <>
    <SetValuesArray />
  </>
);

DebugSetValuesDemo.story = {
  name: 'Debug-SetValuesDemo',
};

export const DebugRerenderTwice = () => (
  <>
    <DoubleRerender />
  </>
);

DebugRerenderTwice.story = {
  name: 'Debug-RerenderTwice',
};

export const _ChildDidMount = () => <ChildDidMount />;

_ChildDidMount.story = {
  name: 'child did mount',
};

