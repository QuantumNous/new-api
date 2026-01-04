import React from 'react';
import warning from '@douyinfe/semi-foundation/utils/warning';
import { OptionProps } from './option';
import { OptionGroupProps } from './optionGroup';

const generateOption = (child: React.ReactElement<any>, parent: any, index: number, newKey?: string | number): OptionProps => {
    const childProps = child.props;
    if (!child || !childProps) {
        return null;
    }
    const option = {
        value: childProps.value,
        // Dropdown menu rendering priority label value, children, value in turn downgrade
        label: childProps.label || childProps.children || childProps.value,
        _show: true,
        _selected: false,
        _scrollIndex: index,
        ...childProps,
        _parentGroup: parent,
    };

    // Props are collected from ReactNode, after React.Children.toArray
    // no need to determine whether the key exists in child
    // Even if the user does not explicitly declare it, React will always generate a key.
    option._keyInJsx = newKey || child.key;
    
    return option;
};

const getOptionsFromGroup = (selectChildren: React.ReactNode) => {
    let optionGroups: OptionGroupProps[] = [];
    let options: OptionProps[] = [];

    const emptyGroup: {
        label: string;
        children: OptionProps[];
        _show: boolean
    } = { label: '', children: [], _show: false };

    // avoid null
    let childNodes = React.Children.toArray(selectChildren) as React.ReactElement<any>[];
    childNodes = childNodes.filter((childNode) => childNode && childNode.props);    

    let type = '';
    let optionIndex = -1;

    childNodes.forEach((child: React.ReactElement<any, any>) => {
        if (child.type.isSelectOption) {
            type = 'option';
            optionIndex++;
            const option = generateOption(child, undefined, optionIndex);
            emptyGroup.children.push(option);
            options.push(option);
        } else if (child.type.isSelectOptionGroup) {
            type = 'group';
            // Avoid saving children (reactNode) by... removing other props from the group except children, causing performance problems
            let { children, ...restGroupProps } = child.props;
            restGroupProps.key = child.key;
            let originKeys = [];
            if (Array.isArray(children)) {
                // if group has children > 1
                originKeys = children.map(item => item.key);
            } else {
                originKeys.push(children.key);
            }
            children = React.Children.toArray(children);
            const childrenOption = children.map((option: React.ReactElement<any>, index: number) => {
                let newKey = option.key;
                if (originKeys[index] === null) {
                    newKey = child.key + '' + option.key; // if option in group and didn't set key, concat parent key to avoid conflict (default generate key just like .0, .1)
                }
                optionIndex++;
                return generateOption(option, restGroupProps, optionIndex, newKey);
            });
            const group = {
                ...child.props,
                children: childrenOption,
                key: child.key,
            };
            optionGroups.push(group);
            options = options.concat(childrenOption);
        } else {
            warning(true, '[Semi Select] The children of `Select` should be `Select.Option` or `Select.OptionGroup`');
        }
    });
    if (type === 'option') {
        optionGroups = [emptyGroup] as OptionGroupProps[];
    }
    return { optionGroups, options };
};

export { generateOption, getOptionsFromGroup };
