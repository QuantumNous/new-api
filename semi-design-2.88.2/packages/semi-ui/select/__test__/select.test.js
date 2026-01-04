import { Select } from '../../index';
import { noop } from 'lodash';
const Option = Select.Option;
const OptGroup = Select.OptGroup;
import { IconClear, IconChevronDown } from '@douyinfe/semi-icons';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import keyCode from '../../../semi-foundation/utils/keyCode';
import {sleep} from "../../_test_/utils";

const defaultList = [
    { value: 'abc', label: 'Abc' },
    { value: 'hotsoon', label: 'Hotsoon' },
    { value: 'pipixia', label: 'Pipixia' },
    { value: 'toutiao', label: 'TopBuzz' },
];

function getOption(list = defaultList) {
    return list.map(optionOpts => <Option {...optionOpts} />);
}

let commonProps = {
    // Select use Popup Layer to show candidate option,
    // but all Popup Layer which extends from Tooltip (eg Popover, Dropdown) have animation and delay.
    // Turn off animation and delay during testing, to avoid waiting (something like setTimeOut/balabala...) in the test code
    motion: false,
    mouseEnterDelay: 0,
    mouseLeaveDelay: 0,
};

function getSelect(props) {
    if (!props.optionList && !props.children) {
        props.children = getOption();
    }

    return mount(<Select {...commonProps} {...props} />, { attachTo: document.getElementById('container') });
}

let stringData = ['semi', 'ies', 'design', 'platform'];

let objectData = [
    { email: 'semi@abc.com', value: 'abc' },
    { email: 'semi@bytedance.com', value: 'bytedance' },
    { email: 'semi@vigo.com', value: 'vigo' },
];

describe('Select', () => {
    beforeEach(() => {
        // Avoid `attachTo: document.body` Warning
        const div = document.createElement('div');
        div.setAttribute('id', 'container');
        document.body.appendChild(div);
    });

    afterEach(() => {
        const div = document.getElementById('container');
        if (div) {
            document.body.removeChild(div);
        }
        document.body.innerHTML = '';
    });

    it('custom className & style', () => {
        let props = {
            className: 'test',
            style: {
                color: 'red',
            },
        };
        const wrapper = getSelect(props);
        expect(wrapper.hasClass('test')).toEqual(true);
        expect(wrapper.find('div.test')).toHaveStyle('color', 'red');
    });

    it('with placeholder', () => {
        const props = { placeholder: 'semi' };
        const select = getSelect(props);
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-selection-placeholder`).instance().textContent).toEqual('semi');
    });

    it('with validateStatus', () => {
        const props = {};
        const select = getSelect(props);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-error`)).toEqual(false);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-warning`)).toEqual(false);
        select.setProps({ validateStatus: 'error' });
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-error`)).toEqual(true);
        select.setProps({ validateStatus: 'warning' });
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-warning`)).toEqual(true);
    });

    it('different size', () => {
        const props = {};
        const select = getSelect(props);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-large`)).toEqual(false);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-small`)).toEqual(false);
        select.setProps({ size: 'large' });
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-large`)).toEqual(true);
        select.setProps({ size: 'small' });
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-small`)).toEqual(true);
    });

    it('custom dropdownClassName & dropdownStyle', () => {
        let props = {
            dropdownClassName: 'ddc',
            dropdownStyle: {
                color: 'red',
            },
            defaultOpen: true,
        };
        let select = getSelect(props);
        expect(select.exists('.ddc')).toEqual(true);
        expect(select.find('.ddc')).toHaveStyle('color', 'red');
    });

    it('different position', () => {
        let props = {
            position: 'top',
            defaultOpen: true,
        };
        let select = getSelect(props);
        expect(
            select
                .find(`.${BASE_CLASS_PREFIX}-popover-wrapper`)
                .instance()
                .getAttribute('x-placement')
        ).toEqual('top');
    });

    it('defaultValue (not candidate in optionList)', () => {
        // single select
        let props = {
            defaultValue: 'semi',
        };
        let select = getSelect(props);
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-selection-text`).getDOMNode().textContent).toEqual('semi');
        select.unmount();
        // multiple select
        let mProps = {
            multiple: true,
            defaultValue: ['semi', 'ies'],
        };
        let mSelect = getSelect(mProps);
        let tags = mSelect.find(`.${BASE_CLASS_PREFIX}-select-selection .semi-tag-content`);
        expect(tags.length).toEqual(2);
        expect(tags.at(0).getDOMNode().textContent).toEqual('semi');
        expect(tags.at(1).getDOMNode().textContent).toEqual('ies');
        mSelect.unmount();
    });

    it('defaultValue  (can match in optionList)', () => {
        // single select
        let props = {
            defaultValue: 'abc',
        };
        let select = getSelect(props);
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-selection-text`).getDOMNode().textContent).toEqual('Abc');
        select.unmount();
        // multiple select
        let mProps = {
            defaultValue: ['abc', 'hotsoon'],
            multiple: true,
        };
        const mSelect = getSelect(mProps);
        let tags = mSelect.find(`.${BASE_CLASS_PREFIX}-select-selection .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.length).toEqual(2);
        expect(tags.at(0).getDOMNode().textContent).toEqual('Abc');
        expect(tags.at(1).getDOMNode().textContent).toEqual('Hotsoon');
        mSelect.unmount();
    });

    it('showClear', () => {
        const props = { defaultValue: '${BASE_CLASS_PREFIX}', showClear: true };
        const select = getSelect(props);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-icon-clear`)).toEqual(false);
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('mouseEnter', {});
        expect(select.exists(`.${BASE_CLASS_PREFIX}-icon-clear`)).toEqual(true);
        select.unmount();

        const emptyProps = { showClear: true };
        const emptySelect = getSelect(emptyProps);
        emptySelect.find(`.${BASE_CLASS_PREFIX}-select`).simulate('mouseEnter', {});
        expect(select.exists(`.${BASE_CLASS_PREFIX}-icon-clear`)).toEqual(false);
        emptySelect.unmount();

        const notShowProps = { showClear: false, defaultValue: 'semi' };
        const noSelect = getSelect(notShowProps);
        noSelect.find(`.${BASE_CLASS_PREFIX}-select`).simulate('mouseEnter', {});
        expect(select.exists(`.${BASE_CLASS_PREFIX}-icon-clear`)).toEqual(false);
        noSelect.unmount();
    });

    it('showArrow = false', () => {
        const props = { defaultValue: 'semi', showArrow: false };
        const select = getSelect(props);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-icon-chevron_down`)).toEqual(false);
    });

    it('custom prefix / suffix / insetLabel', () => {
        let prefix = <div className="prefix">prefix content</div>;
        let suffix = <div className="suffix">suffix content</div>;
        let insetLabel = 'semi';
        const props = {
            prefix: prefix,
            suffix: suffix,
        };
        let select = getSelect(props);
        expect(select.contains(prefix)).toEqual(true);
        expect(select.contains(suffix)).toEqual(true);
        select.unmount();
        let ilSelect = getSelect({ insetLabel: insetLabel });
        expect(ilSelect.contains(insetLabel)).toEqual(true);
        ilSelect.unmount();
    });

    it('defaultOpen', () => {
        let props = {
            defaultOpen: true,
        };
        let select = getSelect(props);
        expect(select.state().isOpen).toEqual(true);
        let options = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        expect(options.length).toEqual(4);
        expect(options.at(0).getDOMNode().textContent).toEqual('Abc');
        expect(options.at(1).getDOMNode().textContent).toEqual('Hotsoon');
    });

    it('dropdownMatchSelectWidth = true', () => {
        // dropdownMatchSelectWidth default is true
        let props = {
            defaultOpen: true,
            style: { width: 90 },
            defaultValue: 'abc',
        };
        let defaultSelect = getSelect(props);
        // cause jsdom doesn't support layout engine like browser, so you can't access offsetWidth/scrollWidth or use getBoundingRect(), it will always return 0;
        // just use getComputedStyle to avoid this problem.
        let selector = defaultSelect.find(`.${BASE_CLASS_PREFIX}-select`).getDOMNode();
        let selectorWidth = window.getComputedStyle(selector).width; // expect 90px
        let list = defaultSelect.find(`.${BASE_CLASS_PREFIX}-select-option-list`).getDOMNode().parentNode;
        let listWidth = window.getComputedStyle(list).minWidth;
        expect(selectorWidth).toEqual(listWidth);
        defaultSelect.unmount();
    });

    it('dropdownMatchSelectWidth, width is string', () => {
        let stringProps = {
            defaultOpen: true,
            style: { width: '90px' },
            defaultValue: 'abc',
        };
        let stringSelect = getSelect(stringProps);
        let strSelector = stringSelect.find(`.${BASE_CLASS_PREFIX}-select`).getDOMNode();
        let strSelectorWidth = window.getComputedStyle(strSelector).width; // expect 90px
        let strList = stringSelect.find(`.${BASE_CLASS_PREFIX}-select-option-list`).getDOMNode().parentNode;
        let strListWidth = window.getComputedStyle(strList).minWidth;
        expect(strSelectorWidth).toEqual(strListWidth);
        stringSelect.unmount();
    });

    it('dropdownMatchSelectWidth = false', () => {
        let notMatchProps = {
            defaultOpen: true,
            style: { width: 90 },
            defaultValue: 'abc',
            dropdownMatchSelectWidth: false,
        };
        let nmSelect = getSelect(notMatchProps);
        let selector = nmSelect.find(`.${BASE_CLASS_PREFIX}-select`).getDOMNode();
        let selectorWidth = window.getComputedStyle(selector).width;
        let list = nmSelect.find(`.${BASE_CLASS_PREFIX}-select-option-list`).getDOMNode().parentNode;
        let listWidth = window.getComputedStyle(list).minWidth;
        expect(selectorWidth).not.toEqual(listWidth);
        nmSelect.unmount();
    });

    it('pass options via props.optionList', () => {
        // expect number and content correct
        const props = {
            defaultOpen: true,
            optionList: defaultList,
        };
        const select = getSelect(props);
        let candidate = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        expect(candidate.length).toEqual(4);
        expect(candidate.at(0).getDOMNode().textContent).toEqual('Abc');
        expect(candidate.at(1).getDOMNode().textContent).toEqual('Hotsoon');
        select.unmount();
    });

    it('pass options via props.children', () => {
        let list = defaultList.slice();
        list.push({ value: 'semi', label: 'SemiDesign' });
        const props = {
            defaultOpen: true,
            children: getOption(list),
        };
        const select = getSelect(props);
        let candidate = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        expect(candidate.length).toEqual(5);
        expect(candidate.at(0).getDOMNode().textContent).toEqual('Abc');
        expect(candidate.at(4).getDOMNode().textContent).toEqual('SemiDesign');
        select.unmount();
    });

    it('can choose more than one option when multiple is true', () => {
        const props = {
            multiple: true,
            defaultValue: ['abc', 'hotsoon'],
            defaultOpen: true,
        };
        const select = getSelect(props);
        let selection = select.find(`.${BASE_CLASS_PREFIX}-select-content-wrapper`).children();
        expect(selection.length).toEqual(2);
        let targetOption = select
            .find(`.${BASE_CLASS_PREFIX}-select-option-list`)
            .children()
            .at(3);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        targetOption.simulate('click', nativeEvent);
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-content-wrapper`).children().length).toEqual(3);
        select.unmount();
    });

    it('multiple with maxTagCount', () => {
        const props = {
            multiple: true,
            defaultValue: ['abc', 'hotsoon'],
            maxTagCount: 2,
            defaultOpen: true,
        };
        const select = getSelect(props);
        let targetOption = select
            .find(`.${BASE_CLASS_PREFIX}-select-option-list`)
            .children()
            .at(3);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        targetOption.simulate('click', nativeEvent);
        let selection = select.find(`.${BASE_CLASS_PREFIX}-tag-group`);
        expect(selection.children().length).toEqual(3);
        expect(
            selection
                .children()
                .at(2)
                .getDOMNode().textContent
        ).toEqual('+1');
        select.unmount();
    });

    it('multiple with max, should call onExceed when selected over max', () => {
        let onExceed = () => {};
        let spyonExceed = sinon.spy(onExceed);
        const props = {
            multiple: true,
            defaultValue: ['abc', 'hotsoon'],
            max: 2,
            onExceed: spyonExceed,
            defaultOpen: true,
        };
        const select = getSelect(props);
        let targetOption = select
            .find(`.${BASE_CLASS_PREFIX}-select-option-list`)
            .children()
            .at(3);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        targetOption.simulate('click', nativeEvent);
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-content-wrapper`).children().length).toEqual(2);
        expect(spyonExceed.calledOnce).toBe(true);
        select.unmount();
    });

    it('innerTopSlot', () => {
        let innerTopSlot = <div className="inner-slot">inner</div>;
        let props = {
            innerTopSlot: innerTopSlot,
            defaultOpen: true,
        };
        const select = getSelect(props);
        expect(select.contains(innerTopSlot)).toEqual(true);
    });

    it('outerTopSlot', () => {
        let outerTopSlot = <div className="outer-slot">outer</div>;
        let props = {
            outerTopSlot: outerTopSlot,
            defaultOpen: true,
        };
        const select = getSelect(props);
        expect(select.contains(outerTopSlot)).toEqual(true);
    });

    // TODO
    it('innerBottomSlot', () => {
        let innerBottomSlot = <div className="inner-slot">inner</div>;
        let props = {
            innerBottomSlot: innerBottomSlot,
            defaultOpen: true,
        };
        const select = getSelect(props);
        expect(select.contains(innerBottomSlot)).toEqual(true);
    });

    it('outerBottomSlot', () => {
        let outerBottomSlot = <div className="outer-slot">outer</div>;
        let props = {
            outerBottomSlot: outerBottomSlot,
            defaultOpen: true,
        };
        const select = getSelect(props);
        expect(select.contains(outerBottomSlot)).toEqual(true);
    });

    it('option className & style & disabled & showTick', () => {
        let options = [
            { className: 'optCls', style: { color: 'red' }, label: 'Abc', value: 'abc' },
            { label: 'Vigo', value: 'vigo', disabled: true, className: 'disabled-opt' },
            { label: 'NoTick', value: 'noTick', showTick: false },
        ];
        options = options.map(item => {
            return <Option {...item}>{item.label}</Option>;
        });
        let props = {
            children: options,
            defaultOpen: true,
        };
        const select = getSelect(props);
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-option.optCls`)).toHaveStyle('color', 'red');
        let optionList = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`);
        expect(optionList.exists(`.${BASE_CLASS_PREFIX}-select-option.disabled-opt`)).toEqual(true);
        expect(
            optionList
                .children()
                .at(2)
                .getDOMNode().textContent
        ).toEqual('NoTick');
    });

    it('loading', () => {
        let props = {
            defaultOpen: true,
            loading: true,
        };
        const select = getSelect(props);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-loading-wrapper`)).toEqual(true);
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children.length).toEqual(1);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-option`)).toEqual(false);
    });

    it('spacing', () => {
        // Can't test spacing directly, just test whether it is passed to Popover correctly
        let props = {
            spacing: 20,
            defaultOpen: true,
        };
        const select = getSelect(props);
        const tooltip = select.children().children();
        expect(tooltip.props().spacing).toEqual(20);
    });

    it('should open optionList when click selector', () => {
        const props = {};
        const select = getSelect(props);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-option-list`)).toEqual(false);
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-option-list`)).toEqual(true);
    });

    it('disabled component when disabled is true', () => {
        const props = { disabled: true };
        const select = getSelect(props);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-disabled`)).toEqual(true);
        // Does not respond click events when disabled is true
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-option-list`)).toEqual(false);
    });

    it('onDropdownVisibleChange & clickToHide', async () => {
        let onDropdownVisible = () => {};
        let spyOnDV = sinon.spy(onDropdownVisible);
        const props = {
            onDropdownVisibleChange: spyOnDV,
            clickToHide: true,
            motion: false
        };
        const select = getSelect(props);
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        await sleep(1000);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-option-list`)).toEqual(true);
        expect(spyOnDV.calledOnce).toEqual(true);
        expect(spyOnDV.calledWithMatch(true)).toEqual(true);
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        await sleep(1000);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-option-list`)).toEqual(false);
        expect(spyOnDV.calledWithMatch(false)).toEqual(true);
    });

    it('filter = true', () => {
        let props = {
            filter: true,
        };
        const select = getSelect(props);
        // click to show input
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        let inputValue = 'abc';
        let event = { target: { value: inputValue } };
        select.find('input').simulate('change', event);
        let optionList = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        expect(optionList.length).toEqual(1);
        expect(optionList.at(0).text()).toEqual('Abc');
    });

    it('filter = true,label includes regex special character and key it at first', () => {
        let props = {
            filter: true,
            optionList: [{label: 'label++',value: ''}]
        };
        const select = getSelect(props);
        // click to show input
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        let inputValue = '+';
        let event = { target: { value: inputValue } };
        select.find('input').simulate('change', event);
        let optionList = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        expect(optionList.length).toEqual(1);
        expect(optionList.at(0).text()).toEqual('label++');
    });

    it('filter = custom function', () => {
        let customFilter = (sugInput, option) => {
            return option.label == 'Hotsoon';
        };
        let props = {
            filter: customFilter,
        };
        const select = getSelect(props);
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        let inputValue = 'tik';
        let event = { target: { value: inputValue } };
        select.find('input').simulate('change', event);
        let optionList = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        expect(optionList.length).toEqual(1);
        expect(optionList.at(0).text()).toEqual('Hotsoon');
    });

    it('onSearch', () => {
        // trigger onSearch when input change
        let onSearch = value => {};
        let spyOnSearch = sinon.spy(onSearch);
        let props = {
            onSearch: spyOnSearch,
            filter: true,
        };
        let select = getSelect(props);
        // click to show input
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        let inputValue = 'semi';
        let event = { target: { value: inputValue } };
        select.find('input').simulate('change', event);
        expect(spyOnSearch.calledOnce).toBe(true);
        expect(spyOnSearch.calledWithMatch(inputValue)).toBe(true);
        select.unmount();
        // when click clear button, should trigger onSearch
        // TODO
    });

    it('emptyContent', () => {
        let emptyContent = 'no data';
        let props = {
            filter: true,
            emptyContent,
        };
        const select = getSelect(props);
        // click to show input
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        let inputValue = 'semi';
        let event = { target: { value: inputValue } };
        select.find('input').simulate('change', event);
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-option-empty`).text()).toEqual(emptyContent);
    });

    it('option value & label', () => {
        let spyOnChange = sinon.spy(() => {});
        let props = {
            optionList: [{ label: 'semi', value: 'bytedance' }],
            defaultOpen: true,
            onChange: spyOnChange,
        };
        const select = getSelect(props);
        let optionList = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        expect(optionList.at(0).text()).toEqual('semi');
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        optionList.at(0).simulate('click', nativeEvent);
        expect(spyOnChange.calledWithMatch('bytedance')).toEqual(true);
    });

    it('option.value is number', () => {
        let spyOnChange = sinon.spy(() => {});
        let props = {
            optionList: [{ label: 'semi', value: 0 }],
            defaultOpen: true,
            onChange: spyOnChange,
        };
        const select = getSelect(props);
        let optionList = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        expect(optionList.at(0).text()).toEqual('semi');
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        optionList.at(0).simulate('click', nativeEvent);
        expect(spyOnChange.calledWithMatch(0)).toEqual(true);
    });

    it('renderSelectedItem, single', () => {
        const spyRSI = sinon.spy(option => {
            return option.value + '-' + option.label;
        });
        let props = {
            renderSelectedItem: spyRSI,
            defaultValue: 'abc',
        };
        const select = getSelect(props);
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-selection-text`).text()).toEqual('abc-Abc');
        expect(spyRSI.calledWith({ value: 'abc', label: 'Abc' }));
    });

    it('renderSelectedItem, single & value = 0, not exist in optionList', () => {
        // test value = 0 & not match in optionList
        const spyRSI2 = sinon.spy(option => option.label + 1);
        let props2 = {
            renderSelectedItem: spyRSI2,
            value: 0,
        };
        const select2 = getSelect(props2);
        expect(select2.find(`.${BASE_CLASS_PREFIX}-select-selection-text`).text()).toEqual('1');
        expect(spyRSI2.calledWith({ value: 0, label: 0 }));
    });

    it('renderSelectedItem - multiple', () => {
        const spyRSI = sinon.spy((option, opts) => {
            let content = option.value + '-' + option.extra;
            return {
                isRenderInTag: true,
                content,
            };
        });
        let props = {
            optionList: [
                { value: 'abc', label: 'Abc', extra: 'a1' },
                { value: 'hotsoon', label: 'Hotsoon', extra: 'b2' },
                { value: 'pipixia', label: 'Pipixia', extra: 'c3' },
                { value: 'toutiao', label: 'TopBuzz', extra: 'd4' },
            ],
            renderSelectedItem: spyRSI,
            defaultValue: ['abc', 'hotsoon'],
            multiple: true,
        };
        const select = getSelect(props);
        let tags = select.find(`.${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.at(0).text()).toEqual('abc-a1');
        expect(tags.at(1).text()).toEqual('hotsoon-b2');
    });

    it('renderSelectedItem - multiple - isRenderInTag: false', () => {
        let item1, item2;
        const spyRSI = sinon.spy((option, opts) => {
            let content = <div className={opts.index}>{option.value + '-' + option.extra}</div>;
            if (opts.index === 0) {
                item1 = content;
            } else if (opts.index === 1) {
                item2 = content;
            }
            return {
                isRenderInTag: false,
                content,
            };
        });
        let props = {
            optionList: [
                { value: 'abc', label: 'Abc', extra: 'a1' },
                { value: 'hotsoon', label: 'Hotsoon', extra: 'b2' },
                { value: 'pipixia', label: 'Pipixia', extra: 'c3' },
                { value: 'toutiao', label: 'TopBuzz', extra: 'd4' },
            ],
            renderSelectedItem: spyRSI,
            defaultValue: ['abc', 'hotsoon'],
            multiple: true,
        };
        const select = getSelect(props);
        const items = select.find(`.${BASE_CLASS_PREFIX}-select-content-wrapper`).children();
        expect(items.at(0).contains(item1));
        expect(items.at(1).contains(item2));
    });

    it('defaultActiveFirstOption', () => {
        const props = {
            defaultActiveFirstOption: true,
            defaultOpen: true,
        };
        const select = getSelect(props);
        // expect first option active
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-option-focused`).text()).toEqual('Abc');
    });

    it('onSelect', () => {
        // trigger onSelect when option has been selected
        let spyOnSelect = sinon.spy((value, option) => {});
        let props = {
            defaultOpen: true,
            onSelect: spyOnSelect,
        };
        let select = getSelect(props);
        let options = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        let firstOption = options.at(0);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        firstOption.simulate('click', nativeEvent);
        expect(spyOnSelect.calledOnce).toBe(true);
        expect(spyOnSelect.calledWith('abc', { value: 'abc', label: 'Abc' })).toBe(true);
        expect(spyOnSelect.calledWith('abc', { value: 'abc', label: 'Abc', extraKey: true })).toBe(false);
    });

    it('onDeselect', () => {
        // trigger onDeselect when option is deselected
        let onDeselect = (value, option) => {};
        let spyOnDeselect = sinon.spy(onDeselect);
        let props = {
            multiple: true,
            spyOnDeselect,
            defaultOpen: true,
            defaultValue: ['abc', 'hotsoon'],
            onDeselect: spyOnDeselect,
        };
        const select = getSelect(props);
        let options = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        const secondOption = options.at(1);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        secondOption.simulate('click', nativeEvent);
        expect(spyOnDeselect.calledOnce).toBe(true);
        expect(spyOnDeselect.calledWith('hotsoon', { value: 'hotsoon', label: 'Hotsoon' })).toBe(true);
        expect(spyOnDeselect.calledWith('hotsoon', { value: 'hotsoon', label: 'Hotsoon', extraKey: true })).toBe(false);
    });

    it('onChange (single)', () => {
        let spyOnChange = sinon.spy((value, option) => {});
        let props = {
            defaultOpen: true,
            onChange: spyOnChange,
        };
        let select = getSelect(props);
        let options = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        let firstOption = options.at(0);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        firstOption.simulate('click', nativeEvent);
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWith('abc')).toBe(true);
    });

    it('onChange (multiple)', () => {
        let spyOnChange = sinon.spy((value, option) => {});
        let props = {
            defaultOpen: true,
            multiple: true,
            onChange: spyOnChange,
        };
        let select = getSelect(props);
        let options = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        options.at(0).simulate('click', nativeEvent);
        options.at(1).simulate('click', nativeEvent);
        expect(spyOnChange.callCount).toEqual(2);
        expect(spyOnChange.getCall(0).args[0]).toEqual(['abc']);
        expect(spyOnChange.getCall(1).args[0]).toEqual(['abc', 'hotsoon']);
    });

    it('onChange + onChangeWithObject (single)', () => {
        let spyOnChange = sinon.spy((value, option) => {});
        let props = {
            defaultOpen: true,
            onChangeWithObject: true,
            onChange: spyOnChange,
        };
        let select = getSelect(props);
        let options = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        let firstOption = options.at(0);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        firstOption.simulate('click', nativeEvent);
        expect(spyOnChange.calledWith({ value: 'abc', label: 'Abc' })).toBe(true);
    });

    it('onChange + onChangeWithObject (multiple)', () => {
        let spyOnChange = sinon.spy((value, option) => {});
        let props = {
            defaultOpen: true,
            onChangeWithObject: true,
            multiple: true,
            onChange: spyOnChange,
        };
        let select = getSelect(props);
        let options = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        options.at(0).simulate('click', nativeEvent);
        options.at(1).simulate('click', nativeEvent);
        expect(spyOnChange.callCount).toEqual(2);
        expect(spyOnChange.getCall(0).args[0]).toEqual([{ value: 'abc', label: 'Abc' }]);
        expect(spyOnChange.getCall(1).args[0]).toEqual([
            { value: 'abc', label: 'Abc' },
            { value: 'hotsoon', label: 'Hotsoon' },
        ]);
    });

    it('【value】controlled mode', () => {
        let spyOnChange = sinon.spy((value, option) => {});

        let props = {
            value: 'abc',
        };
        let select = getSelect(props);
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-selection-text`).getDOMNode().textContent).toEqual('Abc');
        select.setProps({ value: 'hotsoon' });
        select.update();
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-selection-text`).getDOMNode().textContent).toEqual('Hotsoon');
        select.setProps({ value: undefined });
        select.update();
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-selection-text`).getDOMNode().textContent).toEqual('');
        select.unmount();

        let singleProps = {
            value: 'abc',
            optionList: defaultList,
            defaultOpen: true,
            onChange: spyOnChange,
        };
        select = getSelect(singleProps);
        let options = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        options.at(1).simulate('click', nativeEvent);
        expect(spyOnChange.getCall(0).args[0]).toEqual('hotsoon');
        select.unmount();

        let spyMOnChange = sinon.spy((value, option) => {});
        let spyMOnClear = sinon.spy(() => {});
        let multipleProps = {
            value: '',
            optionList: defaultList,
            defaultOpen: true,
            multiple: true,
            filter: true,
            onChange: spyMOnChange,
            showClear: true,
            onClear: spyMOnClear,
        };
        select = getSelect(multipleProps);
        let mOptions = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        mOptions.at(1).simulate('click', nativeEvent);
        expect(spyMOnChange.getCall(0).args[0]).toEqual(['hotsoon']);

        // TODO
        // test 

    });

    it('【onBlur/onFocus】', () => {
        let spyOnBlur = sinon.spy((value, option) => {
        });
        let spyOnFocus = sinon.spy((value, option) => {
        });

        let props = {
            onBlur: spyOnBlur,
            onFocus: spyOnFocus,
        };
        let select = getSelect(props);
        let trigger = select.find('.semi-select');
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        trigger.simulate('click', nativeEvent);
        expect(spyOnFocus.callCount).toEqual(1);

        // Since there is no mechanism such as event bubbling in enzyme + jsdom, the blur event can only be triggered manually on the blur element,
        // and the blur of the `a element` cannot be achieved through the focus `b element`.

        // Adapt to A11y requirements, close the panel will not call the onBlur func 
        select.instance().close();
        expect(spyOnBlur.callCount).toEqual(0);
        select.unmount();
    });

    it('【autoFocus】- filter = false', () => {
        // should focus triggerElement after mounted
        let spyOnBlur = sinon.spy((value, option) => {
            debugger
        });
        let spyOnFocus = sinon.spy((value, option) => {
            debugger
        });
        let props = {
            onBlur: spyOnBlur,
            onFocus: spyOnFocus,
            autoFocus: true,
        };
        let select = getSelect(props);
        // should not trigger focus when autoFocus
        expect(spyOnFocus.callCount).toEqual(0);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-focus`)).toEqual(true);

        select.unmount();
    });

    it('【autoFocus】- filter = true', () => {
        // autoFocus should auto Focus input element when filter is true
        let props = {
            autoFocus: true,
            filter: true
        };
        let select = getSelect(props);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-select-focus`)).toEqual(true);
        expect(select.exists(`.${BASE_CLASS_PREFIX}-input-wrapper-focus`)).toEqual(true);
        select.unmount();
    });

    it('【autoFocus】 & onBlur when autoFocus = true', () => {
        // autoFocus should trigger onBlur when click other element directly （dropdown not open）
        let spyOnBlur = sinon.spy((value, option) => {
        });
        let props = {
            autoFocus: true,
            onBlur: spyOnBlur,
        }

        // but we can't test this case, Orz
        // Since there is no mechanism such as event bubbling in enzyme + jsdom, the blur event can only be triggered manually on the blur element,
        // and the blur of the `a element` cannot be achieved through the focus `b element`.

        // mock blur event on trigger element
        let select = getSelect(props);
        let trigger = select.find('.semi-select');
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        trigger.simulate('blur', nativeEvent);
        expect(spyOnBlur.callCount).toEqual(1);
    });

    it('virtual', () => {
        let spyOnChange = sinon.spy((value) => {
        });
        let optionList = Array.from({ length: 100 }, (v, i) => ({ label: `option-${i}`, value: i }));
        let props = {
            virtualize: {
                itemSize: 36, // px
            },
            defaultOpen: true,
            optionList,
            onChange: spyOnChange,
        };
        let select = getSelect(props);
        let options = select.find('.semi-select-option');
        let firstOption = options.children().at(0);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        firstOption.simulate('click', nativeEvent);
        expect(spyOnChange.callCount).toEqual(1);
        expect(spyOnChange.calledWithMatch(0)).toEqual(true);
    });

    it('OptionGroup', () => {
        let optionList = [
            <Select.OptGroup key={1} label="Group1">
                <Select.Option value="a-1">a-1</Select.Option>
                <Select.Option value="a-2">a-2</Select.Option>
            </Select.OptGroup>,
            <Select.OptGroup key={2} label="Group2">
                <Select.Option value="b-1">b-1</Select.Option>
                <Select.Option value="b-2">b-2</Select.Option>
            </Select.OptGroup>,
            // last option without label
            <Select.OptGroup key={3}>
                <Select.Option value="c-1">c-1</Select.Option>
            </Select.OptGroup>
        ]
        let props = {
            defaultOpen: true,
            children: optionList,
        };
        let select = getSelect(props);
        let options = select.find('.semi-select-group');
        expect(options.length).toEqual(2);
        expect(options.at(0).text()).toEqual('Group1');
        expect(options.at(1).text()).toEqual('Group2');

    });

    it('empty', () => {
        let props = {
            defaultOpen: true,
            optionList: [],
            emptyContent: 'empty'
        };
        let select = getSelect(props);
        let options = select.find('.semi-select-option.semi-select-option-empty');
        expect(options.length).toEqual(1);
        expect(options.at(0).text()).toEqual(props.emptyContent);
        select.setProps({
            emptyContent: null
        })
        select.update()
        expect(select.find('.semi-select-option').length).toEqual(0);
    });

    it('renderOptionItem onClick onMouseEnter', () => {
        let spyOnMouseEnter = sinon.spy((value) => {
        });
        let spyOnClick = sinon.spy((value) => {
        });
        const renderOptionItem = renderProps => {
            const {
                disabled,
                selected,
                label,
                value,
                focused,
                className,
                style,
                onMouseEnter,
                onClick,
                empty,
                emptyContent,
                ...rest
            } = renderProps;
            return <div style={style} className="custom-option" onClick={spyOnClick} onMouseEnter={spyOnMouseEnter}>
                <div className='option-right'>
                    {label}
                </div>
            </div>
        };
        let props = {
            defaultOpen: true,
            optionList: [
                { value: 'abc', label: '抖音', },
                { value: 'jianying', label: '剪映', },
            ],
            renderOptionItem
        };
        let select = getSelect(props);
        let options = select.find('.custom-option');
        expect(options.length).toEqual(2);
        options.at(0).simulate('click');
        expect(spyOnClick.callCount).toEqual(1);
        options.at(1).simulate('mouseenter');
        expect(spyOnMouseEnter.callCount).toEqual(1);
        
    });
    
    it('customTrigger', () => {
        const triggerRender = ({ value, ...rest }) => {
            return (
              <div className="custom-trigger">
                trigger
              </div>
            );
          };
        let props = {
            triggerRender,
        };
        let select = getSelect(props);
        let trigger = select.find('.custom-trigger');
        expect(trigger.length).toEqual(1);
        expect(trigger.at(0).text()).toEqual('trigger');
        trigger.at(0).simulate('click')
        expect(select.find('.semi-select-option').length).toEqual(defaultList.length);
    });

    it('test keyboard press', () => {
        let props = {
            defaultOpen: true,
            optionList: [
                { value: 'abc', label: 'Abc' },
                { value: 'hotsoon', label: 'Hotsoon' },
                { value: 'pipixia', label: 'Pipixia' },
                { value: 'toutiao', label: 'TopBuzz' },
            ],
        };
        let select = getSelect(props);
        // press ⬇️
        // since the defaultActiveFirstOption default to be true, after ⬇️, the second option focused
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('keydown', { keyCode: keyCode.DOWN });
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-option`).at(1).hasClass(`${BASE_CLASS_PREFIX}-select-option-focused`)).toBe(true);
        // press ⬆️
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('keydown', { keyCode: keyCode.UP });
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('keydown', { keyCode: keyCode.UP });
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-option`).at(defaultList.length-1).hasClass(`${BASE_CLASS_PREFIX}-select-option-focused`)).toBe(true);
        // press ESC
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('keydown', { keyCode: keyCode.ESC });
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-option`).exists()).toBe(false);
        // reopen select, press ⬇️ and ENTER, the first option should be selected
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('keydown', { keyCode: keyCode.DOWN });
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('keydown', { keyCode: keyCode.ENTER });
        expect(select.find(`.${BASE_CLASS_PREFIX}-select-selection-text`).text()).toBe(defaultList[0].label);
        select.unmount();

        // test whether backspace can skip disabled option
        let dProps = {
            defaultOpen: true,
            optionList: [
                { value: 'abc', label: 'Abc' },
                { value: 'hotsoon', label: 'Hotsoon', disabled: true },
                { value: 'pipixia', label: 'Pipixia' },
            ],
            defaultValue: ['hotsoon', 'abc'],
            multiple: true,
        };
        let dSelect = getSelect(dProps);
        dSelect.find(`.${BASE_CLASS_PREFIX}-select`).simulate('keydown', { keyCode: keyCode.BACKSPACE });
        let selections = Array.from(dSelect.state().selections);
        expect(selections[0][0]).toEqual('Hotsoon');
    });

    it('allowCreate', () => {
        const props = {
            multiple: true,
            allowCreate: true,
            filter: true,
            optionList: []
        };
        const select = getSelect(props);
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        select.find(`.${BASE_CLASS_PREFIX}-select .${BASE_CLASS_PREFIX}-input`).simulate('change', { target: { value: '1' } });
        select.find(`.${BASE_CLASS_PREFIX}-select-option`).simulate('click', {});
        expect(select.find(`.${BASE_CLASS_PREFIX}-select .semi-tag`).length).toBe(1);
        select.find(`.${BASE_CLASS_PREFIX}-select .${BASE_CLASS_PREFIX}-input`).simulate('keydown', { keyCode: keyCode.BACKSPACE });
        expect(select.find(`.${BASE_CLASS_PREFIX}-select .semi-tag`).length).toBe(0);
    });

    it('【onMouseEnter/onMouseLeave】', () => {
        let spyEnter = sinon.spy((e) => {
        });
        let spyLeave = sinon.spy((e) => {
        });

        let props = {
            onMouseEnter: spyEnter,
            onMouseLeave: spyLeave,
        };
        let select = getSelect(props);
        let trigger = select.find('.semi-select');
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        trigger.simulate('mouseenter', nativeEvent);
        expect(spyEnter.callCount).toEqual(1);

        trigger.simulate('mouseleave', nativeEvent);
        expect(spyLeave.callCount).toEqual(1);
        select.unmount();
    });

    it('ref method', () => {
        let r;
        let props = {
            ref: (ref) => { r = ref },
            filter: true,
            multiple: true,
            optionList: defaultList,
        };

        let select = getSelect(props);
        r.open();
        expect(select.state().isOpen).toEqual(true);

        r.close();
        expect(select.state().isOpen).toEqual(false);

        r.selectAll();
        select.update();
        expect(select.state().selections.size).toEqual(4);

        r.deselectAll();
        expect(select.state().selections.size).toEqual(0);

        r.focus();
        expect(document.activeElement.tagName).toEqual('INPUT');

        select.unmount();
        // selectAll not work when multiple is false
        let r2;
        let props2 = {
            ref: (ref) => { r2 = ref },
            filter: true,
            optionList: defaultList,
        };
        let singleSelect = getSelect(props2);
        r2.selectAll();
        expect(singleSelect.state().selections.size).toEqual(0);
    });

    it('props optionList update after choose some option, uncontrolled mode', () => {

        let props = {
            defaultActiveFirstOption: true,
            optionList: [
                { value: 'abc', label: 'Abc' },
                { value: 'hotsoon', label: 'Hotsoon' }
            ],
            defaultOpen: true,
            multiple: true,
            filter: true,
        };
        
        let select = getSelect(props);
        let options = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        options.at(0).simulate('click', nativeEvent);
        options.at(1).simulate('click', nativeEvent);

        let newList = [
            { value: 'pipixia', label: 'Pipixia' },
            { value: 'toutiao', label: 'TopBuzz' },
        ];
        select.setProps({ optionList: newList });
        select.update();
        let selections = Array.from(select.state().selections);
        expect(selections[0][0]).toEqual('Abc');
        expect(selections[1][0]).toEqual('Hotsoon');
        select.unmount();

        let singleProps = {
            defaultActiveFirstOption: true,
            optionList: [
                { value: 'abc', label: 'Abc' },
                { value: 'hotsoon', label: 'Hotsoon' },
            ],
            defaultOpen: true,
        };

        let singleSelect = getSelect(singleProps);
        let options2 = singleSelect.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        options2.at(0).simulate('click', nativeEvent);
        singleSelect.setProps({ optionList: newList });
        singleSelect.update();
        let selections2 = Array.from(singleSelect.state().selections);
        expect(selections2[0][0]).toEqual('abc');
    });

    it('click tag close when multiple, controlled mode', () => {
        let spyOnChange = sinon.spy((value) => {
        });
        let spyOnDeselect = sinon.spy((option) => {
        });
        let props = {
            optionList: [
                { value: 'abc', label: 'Abc' },
                { value: 'hotsoon', label: 'Hotsoon' },
            ],
            multiple: true,
            value: ['abc', 'hotsoon'],
            onChange: spyOnChange,
            onDeselect: spyOnDeselect,
        };
        let select = getSelect(props);
        let tagClose = select.find('.semi-tag-close').children();
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        tagClose.at(0).simulate('click', nativeEvent);
        expect(spyOnDeselect.calledWith('abc'));
        expect(spyOnChange.calledWith(['hotsoon']));
    });

    it('autoClearSearchValue', () => {
        // default usage
        let optionList = Array.from({ length: 100 }, (v, i) => ({ label: `option-${i}`, value: i }));

        let props = {
            multiple: true,
            optionList: optionList,
            defaultOpen: true,
            filter: true,
        };
        let select = getSelect(props);
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        let keyword = 'option';
        let event = { target: { value: keyword } };
        select.find('input').simulate('change', event);

        let options = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        options.at(0).simulate('click', nativeEvent);
        let inputValue = select.find('input').getDOMNode().value;
        expect(inputValue).toEqual('');
    });

    it('autoClearSearchValue = false', () => {
        let optionList = Array.from({ length: 100 }, (v, i) => ({ label: `option-${i}`, value: i }));

        let props = {
            multiple: true,
            optionList: optionList,
            defaultOpen: true,
            autoClearSearchValue: false,
            filter: true,
        };
        let select = getSelect(props);
        select.find(`.${BASE_CLASS_PREFIX}-select`).simulate('click', {});
        let keyword = 'option';
        let event = { target: { value: keyword } };
        select.find('input').simulate('change', event);

        let options = select.find(`.${BASE_CLASS_PREFIX}-select-option-list`).children();
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        options.at(0).simulate('click', nativeEvent);
        let inputValue = select.find('input').getDOMNode().value;
        expect(inputValue).toEqual(keyword);
    });
    // TODO ref selectAll \deselectAll when onChangeWithObject is true
    // TODO when loading is true, do not response any keyboard event
    // TODO can't remove tag when option is disabled
    // it('allowCreate-renderCreateItem', ()=>{})
    // it('autoAdjustOverflow', ()=>{})
    // it('remote', ()=>{})

    //     it('【data】updateOptionList when data change', () => {
    //         let props = {
    //             defaultOpen: true,
    //             data: ['semi'],
    //             ...commonProps
    //         };
    //         let ac = getAc(props);
    //         let candidate = ac.find(`.${BASE_CLASS_PREFIX}-autocomplete-option-list`).children();
    //         expect(candidate.length).toEqual(1);
    //         expect(candidate.at(0).getDOMNode().textContent).toEqual('${BASE_CLASS_PREFIX}');
    //         ac.setProps({ data: ['ies', 'design']});
    //         ac.update();
    //         candidate = ac.find(`.${BASE_CLASS_PREFIX}-autocomplete-option-list`).children();
    //         expect(candidate.length).toEqual(2);
    //         expect(candidate.at(0).getDOMNode().textContent).toEqual('ies');
    //         expect(candidate.at(1).getDOMNode().textContent).toEqual('design');
    //     })
});
