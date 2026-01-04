import { Icon, AutoComplete } from '../../index';
import { noop } from 'lodash';
import sinon from 'sinon';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import keyCode from '@douyinfe/semi-foundation/utils/keyCode';

function getAc(props, needAttachTo) {
    return mount(<AutoComplete {...props} />, { attachTo: document.getElementById('container') });
}

let stringData = ['semi', 'ies', 'design', 'platform'];
let objectData = [
    { email: 'semi@abc.com', value: 'abc' },
    { email: 'semi@bytedance.com', value: 'bytedance' },
    { email: 'semi@vigo.com', value: 'vigo' },
];

let commonProps = {
    // AutoComplete use Popup Layer to show candidate option,
    // but all Popup Layer which extends from Tooltip (eg Popover, Dropdown) have animation and delay.
    // Turn off animation and delay during testing, to avoid wating (something like setTimeOut/balabala...) in the test code
    motion: false,
    mouseEnterDelay: 0,
    mouseLeaveDelay: 0,
};

describe('AutoComplete', () => {
    beforeEach(() => {
        // Avoid `attachTo: document.body` Warning
        // document.body.innerHTML = '';
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

    it('【style & className】custom className & style', () => {
        let props = {
            className: 'test',
            style: {
                color: 'red',
            },
        };
        const wrapper = getAc(props);
        expect(wrapper.hasClass('test')).toEqual(true);
        expect(wrapper.find('div.test')).toHaveStyle('color', 'red');
        wrapper.unmount();
    });

    it('【placeholder】with placeholder', () => {
        const props = { placeholder: 'semi' };
        const ac = getAc(props);
        expect(ac.find('input').instance().placeholder).toEqual('semi');
    });

    it('【size】different size', () => {
        const props = { size: 'small' };
        const ac = getAc(props);
        expect(ac.exists(`.${BASE_CLASS_PREFIX}-input-small`)).toEqual(true);
        ac.setProps({ size: 'large' });
        expect(ac.exists(`.${BASE_CLASS_PREFIX}-input-large`)).toEqual(true);
    });

    it('【disabled】disabled component when disabled is true', () => {
        const props = { disabled: true };
        const ac = getAc(props);
        expect(ac.exists(`.${BASE_CLASS_PREFIX}-autocomplete-disabled`)).toEqual(true);
    });

    it('【prefix & suffix】custom prefix & suffix', () => {
        let prefix = <div className="prefix">prefix content</div>;
        let suffix = <div className="suffix">suffix content</div>;
        const props = {
            prefix,
            suffix,
        };
        let ac = getAc(props);
        expect(ac.contains(prefix)).toEqual(true);
        expect(ac.contains(suffix)).toEqual(true);
    });

    it('【dropdownClassName & dropdownStyle】custom dropdownClassName & dropdownStyle', () => {
        let props = {
            dropdownClassName: 'ddc',
            dropdownStyle: {
                color: 'red',
            },
            defaultOpen: true,
            ...commonProps,
        };
        let ac = getAc(props);
        expect(ac.exists(`.${BASE_CLASS_PREFIX}-autocomplete-option-list.ddc`)).toEqual(true);
        expect(ac.find(`.${BASE_CLASS_PREFIX}-autocomplete-option-list.ddc`)).toHaveStyle('color', 'red');
    });

    it('【position】different position', () => {
        let props = {
            position: 'top',
            data: stringData,
            defaultOpen: true,
            ...commonProps,
        };
        let ac = getAc(props);
        expect(
            ac
                .find(`.${BASE_CLASS_PREFIX}-popover-wrapper`)
                .instance()
                .getAttribute('x-placement')
        ).toEqual('top');
    });

    it('【defaultValue】with defaultValue(not candidate in data)', () => {
        let props = {
            defaultValue: 'semi',
            data: [],
            ...commonProps,
        };
        let ac = getAc(props);
        expect(ac.find('input').instance().value).toEqual('semi');
    });

    it('【defaultValue】with defaultValue(can match in data)', () => {
        let props = {
            defaultValue: 'semi',
            data: stringData,
            ...commonProps,
        };
        let ac = getAc(props);
        expect(ac.find('input').instance().value).toEqual('semi');
    });

    it('【onSearch】trigger onSearch when input change', () => {
        let onSearch = value => {};
        let spyOnSearch = sinon.spy(onSearch);
        let props = {
            onSearch: spyOnSearch,
        };
        let ac = getAc(props);
        let inputValue = 'semi';
        let event = { target: { value: inputValue } };
        ac.find('input').simulate('change', event);
        expect(spyOnSearch.calledOnce).toBe(true);
        expect(spyOnSearch.calledWithMatch(inputValue)).toBe(true);
    });

    it('optionList should show when defaultOpen is true & data not empty', () => {
        let props = {
            defaultOpen: true,
            data: stringData,
            ...commonProps,
        };
        let ac = getAc(props);
        expect(ac.state().visible).toEqual(true);
        let candidate = ac.find(`.${BASE_CLASS_PREFIX}-autocomplete-option-list`).children();
        expect(candidate.length).toEqual(4);
        expect(candidate.at(0).getDOMNode().textContent).toEqual('semi');
        expect(candidate.at(1).getDOMNode().textContent).toEqual('ies');
    });

    it('【data】updateOptionList when data change', () => {
        let props = {
            defaultOpen: true,
            data: ['semi'],
            ...commonProps,
        };
        let ac = getAc(props);
        let candidate = ac.find(`.${BASE_CLASS_PREFIX}-autocomplete-option-list`).children();
        expect(candidate.length).toEqual(1);
        expect(candidate.at(0).getDOMNode().textContent).toEqual('semi');
        ac.setProps({ data: ['ies', 'design'] });
        ac.update();
        candidate = ac.find(`.${BASE_CLASS_PREFIX}-autocomplete-option-list`).children();
        expect(candidate.length).toEqual(2);
        expect(candidate.at(0).getDOMNode().textContent).toEqual('ies');
        expect(candidate.at(1).getDOMNode().textContent).toEqual('design');
    });

    it('【loading】hide optionList & show loading when loading is true', () => {
        let props = {
            loading: true,
            defaultOpen: true,
            data: stringData,
            ...commonProps,
        };
        let ac = getAc(props);
        expect(ac.exists(`.${BASE_CLASS_PREFIX}-autocomplete-loading-wrapper`)).toEqual(true);
        expect(ac.exists(`.${BASE_CLASS_PREFIX}-autocomplete-option`)).toEqual(false);
    });

    it('【onSelect】trigger onSelect when click candidate option', () => {
        let onSelect = () => {};
        let spyOnSelect = sinon.spy(onSelect);
        let props = {
            defaultOpen: true,
            data: stringData,
            onSelect: spyOnSelect,
            ...commonProps,
        };
        let ac = getAc(props);
        let options = ac.find(`.${BASE_CLASS_PREFIX}-autocomplete-option`);
        let firstOption = options.at(0);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        firstOption.simulate('click', nativeEvent);
        expect(spyOnSelect.calledOnce).toBe(true);
        expect(spyOnSelect.calledWithMatch(`${BASE_CLASS_PREFIX}`)).toBe(true);
    });

    it('【onSelect】callback with object when onSelectWithObject is true', () => {
        let onSelect = v => {};
        let spyOnSelect = sinon.spy(onSelect);
        let props = {
            defaultOpen: true,
            data: objectData,
            onSelect: spyOnSelect,
            onSelectWithObject: true,
            ...commonProps,
        };
        let ac = getAc(props);
        let options = ac.find(`.${BASE_CLASS_PREFIX}-autocomplete-option`);
        let firstOption = options.at(0);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        firstOption.simulate('click', nativeEvent);
        expect(spyOnSelect.calledOnce).toBe(true);
        expect(spyOnSelect.calledWithMatch(objectData[0])).toBe(true);
    });

    it('show candidate option list after click AutoComplete(when data not empty)', () => {
        let props = {
            data: stringData,
            ...commonProps,
        };
        let ac = getAc(props);
        let acCls = `.${BASE_CLASS_PREFIX}-autocomplete`;
        ac.find(acCls).simulate('click', {});
        expect(ac.state().visible).toEqual(true);
        expect(ac.exists(`.${BASE_CLASS_PREFIX}-autocomplete-option-list`)).toEqual(true);
    });

    // TODO
    // it('show clear button when input has value and showClear is true', () => {
    //     let props = {
    //         data: stringData,
    //         showClear: true,
    //         ...commonProps
    //     };
    //     let ac = getAc(props);
    //     // input Clear button only show when focus/hover
    //     ac.find(`.${BASE_CLASS_PREFIX}-autocomplete`).simulate('click', {});
    //     ac.find('input').simulate('change', { target: { value: '${BASE_CLASS_PREFIX}' }});
    //     expect(ac.exists(`.${BASE_CLASS_PREFIX}-input-clearbtn`)).toEqual(true);
    // });

    // it('trigger onSearch when click clear button', () => {

    // });

    it('renderSelectedItem', () => {
        let props = {
            data: objectData,
            defaultOpen: true,
            ...commonProps,
            renderSelectedItem: option => option.email,
        };
        let ac = getAc(props);
        let options = ac.find(`.${BASE_CLASS_PREFIX}-autocomplete-option`);
        let firstOption = options.at(0);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        firstOption.simulate('click', nativeEvent);
        expect(ac.find('input').instance().value).toEqual(objectData[0].email);
    });

    it('renderItem in controlled mode', () => {
        const fakeOnChange = sinon.spy();
        let props = {
            data: [
                {
                    name: '夏可漫',
                    label: '夏可漫',
                    value: 'xiakeman@example.com',
                    email: 'xiakeman@example.com',
                    abbr: 'XK',
                    color: 'amber',
                },
                {
                    name: '申悦',
                    label: '申悦',
                    value: 'shenyue@example.com',
                    email: 'shenyue@example.com',
                    abbr: 'SY',
                    color: 'indigo',
                },
            ],
            motion: false,
            defaultOpen: true,
            mouseEnterDelay: 0,
            mouseLeaveDelay: 0,
            renderSelectedItem: option => option.abbr,
            onChange: fakeOnChange,
            value: '',
        };
        const ac = getAc(props);
        ac.find(`.${BASE_CLASS_PREFIX}-autocomplete-option`)
            .at(0)
            .simulate('click');
        expect(fakeOnChange.calledWith('XK')).toEqual(true);
    });

    it('【value】controlled mode', () => {
        let props = {
            data: [],
            ...commonProps,
            value: 'semi',
        };
        let ac = getAc(props);
        expect(ac.find('input').instance().value).toEqual('semi');
        ac.setProps({ value: 'ies' });
        ac.update();
        expect(ac.find('input').instance().value).toEqual('ies');
    });

    it('【autoFocus】works', () => {
        let onFocus = () => {};
        let spyOnFocus = sinon.spy(onFocus);
        const props = {
            autoFocus: true,
            onFocus: spyOnFocus,
        };
        const ac = getAc(props);
        expect(spyOnFocus.calledOnce).toBe(true);
        expect(ac.exists(`.${BASE_CLASS_PREFIX}-input-wrapper-focus`)).toBe(true);
    });

    it('【emptyContent】shows when data is empty', () => {
        const props = {
            defaultOpen: true,
            data: [],
            emptyContent: <div className="custom-empty-content">emptycontent</div>,
            ...commonProps,
        };
        const ac = getAc(props);
        expect(ac.exists('.custom-empty-content')).toBe(true);
    });

    it('【emptyContent】not show when data is not empty', () => {
        const props = {
            defaultOpen: true,
            data: [1, 2, 3],
            emptyContent: <div className="custom-empty-content">emptycontent</div>,
            ...commonProps,
        };
        const ac = getAc(props);
        expect(ac.exists('.custom-empty-content')).toBe(false);
    });

    it('【onChange should be triggered in right occasion】', () => {
        const spyOnChange = sinon.spy();
        const props = {
            defaultOpen: true,
            onChange: spyOnChange,
            data: ['hello', 'bytedance', 'semi'],
            showClear: true,
            motion: false,
            mouseEnterDelay: 0,
            mouseLeaveDelay: 0,
        };
        const component = getAc(props);
        let event = { target: { value: 'abc' } };
        component.find('input').simulate('change', event);
        expect(spyOnChange.calledWith('abc')).toEqual(true);
        let options = component.find(`.${BASE_CLASS_PREFIX}-autocomplete-option`);
        let firstOption = options.at(0);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        firstOption.simulate('click', nativeEvent);
        expect(spyOnChange.calledWith('hello')).toEqual(true);
    });

    it('maxHeight', () => {
        let props = {
            maxHeight: 400,
            data: ['a', 'b', 'c'],
            defaultOpen: true,
            ...commonProps
        };
        let ac = getAc(props);
        let dom = document.querySelector('.semi-autocomplete-option-list');
        expect(dom.style.maxHeight).toEqual('400px');
    });

    it('zIndex', () => {
        const props = {
            defaultOpen: true,
            data: ['a', 'b', 'c'],
            zIndex: 998,
            ...commonProps
        };
        const ac = getAc(props);
        let popupDom = document.querySelector('.semi-portal');
        expect(popupDom.style.zIndex).toEqual('998');
    });

    it('set trigger width', () => {
        let numberWidth = {
            defaultOpen: true,
            style: {
                width: 200
            },
            ...commonProps
        };
        let numberAc = getAc(numberWidth);
        let dom = document.querySelector('.semi-autocomplete-option-list');
        expect(dom.style.minWidth).toEqual('200px');

        let stringWidth = {
            defaultOpen: true,
            style: {
                width: '80px'
            },
            ...commonProps
        };
        let stringAc = getAc(stringWidth);
        let stringDom = document.querySelector('.semi-autocomplete-option-list');
        expect(stringDom.style.minWidth).toEqual('80px');
    })

    // it('onBlur', () => {
        
    // });

    // it('keyboard event', () => {
    //     let numberWidth = {
    //         defaultOpen: true,
    //         style: {
    //             width: 200
    //         },
    //         defaultActiveFirstOption: true,
    //         data: ['a', 'b', 'c', 'd'],
    //         ...commonProps
    //     };
    //     let numberAc = getAc(numberWidth);
    //     numberAc.simulate('keydown', { keyCode: keyCode['ENTER'] });
    //     numberAc.simulate('keydown', { keyCode: keyCode['UP'] });
    //     numberAc.simulate('keydown', { keyCode: keyCode['DOWN'] });
    //     numberAc.simulate('keydown', { keyCode: keyCode['ESC'] });
    // });

    // it('triggerRender', () => {

    // });
});
