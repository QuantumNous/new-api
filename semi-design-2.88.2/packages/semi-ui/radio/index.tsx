import Group from './radioGroup';
import Radio from './radio';

class RadioWithGroup extends Radio {
    static Group = Group;
}

export default RadioWithGroup;
export { RadioWithGroup, Radio };
export type { RadioInnerMode, RadioInnerProps } from './radioInner';
export type { RadioGroupProps, OptionItem } from './radioGroup';
export type { RadioDisplayMode, RadioType, RadioProps, RadioChangeEvent } from './radio';