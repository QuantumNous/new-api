import withField from './hoc/withField';

// Basic component
import Input from '../input/index';
import TextArea from '../input/textarea';
import InputNumber from '../inputNumber/index';
import Select from '../select/index';
import { Checkbox } from '../checkbox/index';
import CheckboxGroup from '../checkbox/checkboxGroup';
import { Radio } from '../radio/index';
import RadioGroup from '../radio/radioGroup';

import DatePicker from '../datePicker/index';
import Switch from '../switch/index';
import Slider from '../slider/index';
import TimePicker from '../timePicker/index';
import TreeSelect from '../treeSelect/index';
import Cascader from '../cascader/index';
import Rating from '../rating/index';
import AutoComplete from '../autoComplete/index';
import Upload from '../upload/index';
import TagInput from '../tagInput/index';
import { FormCheckboxType, FormRadioType, FormSelectType } from './interface';

const FormInput = withField(Input, { maintainCursor: true });
const FormInputNumber = withField(InputNumber, { maintainCursor: true });
const FormTextArea = withField(TextArea, { maintainCursor: true });

const FormSelect = withField(Select) as typeof FormSelectType;
// Select after withField is a new Component, without the Option attribute, it needs to be manually assigned once
FormSelect.Option = Select.Option;
FormSelect.OptGroup = Select.OptGroup;

const FormCheckboxGroup = withField(CheckboxGroup);
const FormCheckbox = withField(Checkbox, {
    valueKey: 'checked',
    valuePath: 'target.checked',
    shouldInject: false,
}) as typeof FormCheckboxType;
const FormRadioGroup = withField(RadioGroup, { valuePath: 'target.value' });
const FormRadio = withField(Radio, {
    valueKey: 'checked',
    valuePath: 'target.checked',
    shouldInject: false,
}) as typeof FormRadioType;

const FormDatePicker = withField(DatePicker);
const FormSwitch = withField(Switch, { valueKey: 'checked' });
const FormSlider = withField(Slider);
const FormTimePicker = withField(TimePicker);
const FormTreeSelect = withField(TreeSelect);
const FormCascader = withField(Cascader);
const FormRating = withField(Rating);
const FormAutoComplete = withField(AutoComplete, { valueKey: 'value', onKeyChangeFnName: 'onChange' });
const FormUpload = withField(Upload, { valueKey: 'fileList', valuePath: 'fileList', onKeyChangeFnName: 'onChange' });
const FormTagInput = withField(TagInput);

export {
    FormInput,
    FormInputNumber,
    FormTextArea,
    FormSelect,
    FormCheckboxGroup,
    FormCheckbox,
    FormRadioGroup,
    FormRadio,
    FormDatePicker,
    FormSwitch,
    FormSlider,
    FormTimePicker,
    FormTreeSelect,
    FormCascader,
    FormRating,
    FormAutoComplete,
    FormUpload,
    FormTagInput
};
