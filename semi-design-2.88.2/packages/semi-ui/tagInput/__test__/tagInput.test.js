import { Icon, TagInput } from '../../index';
import { noop } from 'lodash';
import { cssClasses } from '@douyinfe/semi-foundation/icons/constants';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
const prefixCls = cssClasses.PREFIX;

function getTagInput(props) {
    return mount(<TagInput {...props} />, { attachTo: document.getElementById('container') });
}

describe('TagInput', () => {
    it('TagInput with prefix / suffix', () => {
        const suffix = <div className="suffix">suffix</div>;
        const prefix = <div className="prefix">prefix</div>;
        const withNodeSuffix = mount(<TagInput suffix={suffix} />);
        const withNodePrefix = mount(<TagInput prefix={prefix} />);
        expect(withNodeSuffix.contains(suffix)).toEqual(true);
        expect(withNodePrefix.contains(prefix)).toEqual(true);
    });

    it('TagInput with validateStatus', () => {
        const warningTagInput = mount(<TagInput validateStatus="warning" />);
        const errorTagInput = mount(<TagInput validateStatus="error" />);
        const defaultTagInput = mount(<TagInput />);
        expect(warningTagInput.exists(`.${BASE_CLASS_PREFIX}-tagInput-warning`)).toEqual(true);
        expect(errorTagInput.exists(`.${BASE_CLASS_PREFIX}-tagInput-error`)).toEqual(true);
        expect(defaultTagInput.exists(`.${BASE_CLASS_PREFIX}-tagInput-error`)).toEqual(false);
        expect(defaultTagInput.exists(`.${BASE_CLASS_PREFIX}-tagInput-warning`)).toEqual(false);
    });

    it('TagInput with placeholder', () => {
        const placeholderText = `semi placeholder`;
        const tagInput = mount(<TagInput placeholder={placeholderText} />);
        const tagInputDom = tagInput.find('input');
        expect(tagInputDom.props().placeholder).toEqual(placeholderText);
    });

    it('TagInput with custom className & style', () => {
        const wrapper = mount(<TagInput className="test" style={{ color: 'red' }} />);
        expect(wrapper.hasClass('test')).toEqual(true);
        expect(wrapper.find('div.test')).toHaveStyle('color', 'red');
    });

    it('TagInput with size', () => {
        const largeTagInput = mount(<TagInput size="large" />);
        const smallTagInput = mount(<TagInput size="small" />);
        expect(largeTagInput.find(`.semi-input-large`)).toHaveLength(1);
        expect(smallTagInput.find(`.semi-input-small`)).toHaveLength(1);
    });

    it('TagInput with showClear', () => {
        const showTagInput = mount(<TagInput showClear={true} />);
        expect(showTagInput.exists(`.${BASE_CLASS_PREFIX}-icon-clear`)).toEqual(true);
        expect(showTagInput.simulate('mouseEnter', {}).exists(`.${BASE_CLASS_PREFIX}-tagInput-clearBtn-invisible`)).toEqual(true);
        showTagInput.unmount();

        const notShowTagInput = mount(<TagInput showClear={false} />);
        expect(notShowTagInput.exists(`.${BASE_CLASS_PREFIX}-icon-clear`)).toEqual(false);
        notShowTagInput.unmount();

        const tagInput = mount(<TagInput showClear={true} inputValue='semi' />);
        expect(tagInput.exists(`.${BASE_CLASS_PREFIX}-tagInput-clearBtn-invisible`)).toEqual(true);
        expect(tagInput.simulate('mouseEnter', {}).exists(`.${BASE_CLASS_PREFIX}-tagInput-clearBtn-invisible`)).toEqual(false);
        tagInput.unmount();
    });

    it('TagInput with defaultValue', () => {
        const props = {
            defaultValue: ['abc', 'hotsoon']
        };
        const tagInput = getTagInput(props);
        const tags = tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.length).toEqual(2);
        expect(tags.at(0).getDOMNode().textContent).toEqual('abc');
        expect(tags.at(1).getDOMNode().textContent).toEqual('hotsoon');
        tagInput.unmount();
    });

    it('TagInput with defaultValue and value is undefined', () => {
        const props = {
            defaultValue: ['semi', 'hotsoon'],
            value: undefined,
        };
        const tagInput = getTagInput(props);
        const tags = tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.length).toEqual(0);
        tagInput.unmount();
    });

    it('TagInput with defaultValue and value is null', () => {
        const props = {
            defaultValue: ['semi', 'hotsoon'],
            value: null,
        };
        const tagInput = getTagInput(props);
        const tags = tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.length).toEqual(0);
        tagInput.unmount();
    });

    it('TagInput with disabled', () => {
        const disabledTagInput = mount(<TagInput disabled />);
        expect(disabledTagInput.exists(`.${BASE_CLASS_PREFIX}-tagInput-disabled`)).toEqual(true);
        disabledTagInput.unmount();
        const tagInput = mount(<TagInput />);
        expect(tagInput.exists(`.${BASE_CLASS_PREFIX}-tagInput-disabled`)).toEqual(false);
        tagInput.unmount();
    });

    it('TagInput with separator', () => {
        const props = {
            separator: '-',
            inputValue: 'abc-hotsoon'
        }
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('keyDown', { keyCode: 13 });
        const tags = tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.length).toEqual(2);
        expect(tags.at(0).getDOMNode().textContent).toEqual('abc');
        expect(tags.at(1).getDOMNode().textContent).toEqual('hotsoon');
        tagInput.unmount();

        /* when separator is null */
        const props2 = {
            separator: null,
            inputValue: 'semi-hotsoon'
        }
        const tagInput2 = getTagInput(props2);
        tagInput2.find('input').simulate('keyDown', { keyCode: 13 });
        const tags2 = tagInput2.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags2.length).toEqual(1);
        expect(tags2.at(0).getDOMNode().textContent).toEqual('semi-hotsoon');
        tagInput2.unmount();

        /* when separator is number */
        const props3 = {
            separator: 1,
            inputValue: 'semi1design'
        }
        const tagInput3 = getTagInput(props3);
        tagInput3.find('input').simulate('keyDown', { keyCode: 13 });
        const tags3 = tagInput3.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags3.length).toEqual(2);
        expect(tags3.at(0).getDOMNode().textContent).toEqual('semi');
        expect(tags3.at(1).getDOMNode().textContent).toEqual('design');
        tagInput3.unmount();
    });

    
    it('TagInput with arrat type separator', () => {
        const props = {
            separator: ['-','/','*'],
            inputValue: 'abc-hotsoon/pipixi*qingyan'
        }
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('keyDown', { keyCode: 13 });
        const tags = tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.length).toEqual(4);
        expect(tags.at(0).getDOMNode().textContent).toEqual('abc');
        expect(tags.at(1).getDOMNode().textContent).toEqual('hotsoon');
        expect(tags.at(2).getDOMNode().textContent).toEqual('pipixi');
        expect(tags.at(3).getDOMNode().textContent).toEqual('qingyan');
        tagInput.unmount();
    });


    it('TagInput with onRemove & onChange', () => {
        const spyOnRemove = sinon.spy(value => { });
        const spyOnChange = sinon.spy(value => { });
        const props = {
            defaultValue: ['abc', 'hotsoon', 'toutiao', 'lark'],
            onRemove: spyOnRemove,
            onChange: spyOnChange,
            showClear: true
        };
        const tagInput = getTagInput(props);
        const nativeEvent = { nativeEvent: { stopImmediatePropagation: noop } };
        tagInput.find(`.${BASE_CLASS_PREFIX}-tag-close`).at(1).simulate('click', nativeEvent);
        tagInput.find('input').simulate('keyDown', { keyCode: 8 });
        tagInput.simulate('mouseEnter', {}).find(`.${BASE_CLASS_PREFIX}-tagInput-clearBtn`).simulate('click', nativeEvent);
        expect(spyOnRemove.callCount).toEqual(2);
        expect(spyOnChange.callCount).toEqual(3);

        //click tagCloseBtn
        expect(spyOnRemove.getCall(0).args[0]).toEqual('hotsoon');
        expect(spyOnChange.getCall(0).args[0]).toEqual(['abc', 'toutiao', 'lark']);

        //enter basespace
        expect(spyOnRemove.getCall(1).args[0]).toEqual('lark');
        expect(spyOnChange.getCall(1).args[0]).toEqual(['abc', 'toutiao']);

        //click clearBtn
        expect(spyOnChange.getCall(2).args[0]).toEqual([]);

        tagInput.unmount();
    });

    it('TagInput with onAdd & onChange', () => {
        const spyOnAdd = sinon.spy(value => { });
        const spyOnChange = sinon.spy(value => { });

        // inputValue is empty
        const emptyProps = {
            onChange: spyOnChange,
            onAdd: spyOnAdd
        };
        const emptyTagInput = getTagInput(emptyProps);
        emptyTagInput.find('input').simulate('keyDown', { keyCode: 13 });
        expect(spyOnAdd.callCount).toEqual(0);
        expect(spyOnChange.callCount).toEqual(0);
        emptyTagInput.unmount();

        // inputValue is not empty
        const props = {
            inputValue: 'abc,toutiao,,,hotsoon',
            onChange: spyOnChange,
            defaultValue: ['lark'],
            onAdd: spyOnAdd
        };
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('keyDown', { keyCode: 13 });
        expect(spyOnAdd.callCount).toEqual(1);
        expect(spyOnAdd.getCall(0).args[0]).toEqual(['abc', 'toutiao', 'hotsoon']);
        expect(spyOnChange.callCount).toEqual(1);
        expect(spyOnChange.getCall(0).args[0]).toEqual(['lark', 'abc', 'toutiao', 'hotsoon']);
        tagInput.unmount();
    });

    it('TagInput with max', () => {
        const props = {
            defaultValue: ['abc', 'hotsoon'],
            max: 2,
            inputValue: 'lark',
        };
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('keyDown', { keyCode: 13 });
        const tags = tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.length).toEqual(2);
        expect(tags.at(0).getDOMNode().textContent).toEqual('abc');
        expect(tags.at(1).getDOMNode().textContent).toEqual('hotsoon');
        tagInput.unmount();
    });

    it('TagInput with maxTagCount', () => {
        const props = {
            defaultValue: ['abc', 'hotsoon'],
            maxTagCount: 2,
            inputValue: 'lark',
        };
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('keyDown', { keyCode: 13 });
        const tags = tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.length).toEqual(2);
        expect(tags.at(0).getDOMNode().textContent).toEqual('abc');
        expect(tags.at(1).getDOMNode().textContent).toEqual('hotsoon');
        const n = tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper-n`);
        expect(n.at(0).getDOMNode().textContent).toEqual('+1');
        tagInput.unmount();
    });

    it('TagInput with maxLength', () => {
        const props = {
            maxLength: 3,
        };
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('change', { target: { value: "tik" } });
        expect(tagInput.find('input').getDOMNode().value).toEqual('tik');
        tagInput.find('input').simulate('change', { target: { value: "tikt" } });
        expect(tagInput.find('input').getDOMNode().value).toEqual('tik');
        tagInput.unmount();
    });

    it('TagInput with onExceed', () => {
        const spyOnExceed = sinon.spy(() => { });
        const props = {
            max: 2,
            defaultValue: ['abc', 'hotsoon'],
            inputValue: 'semi',
            onExceed: spyOnExceed
        };
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('keyDown', { keyCode: 13 });
        expect(spyOnExceed.callCount).toEqual(1);
        tagInput.unmount();
    });

    it('TagInput with onInputExceed', () => {
        const spyOnInputExceed = sinon.spy(() => { });
        const props = {
            maxLength: 2,
            onInputExceed: spyOnInputExceed
        };
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('change', { target: { value: "hotsoon" } });
        expect(spyOnInputExceed.callCount).toEqual(1);
        tagInput.unmount();
    });

    it('TagInput with onInputChange', () => {
        const spyOnInputChange = sinon.spy(() => { });
        const props = {
            onInputChange: spyOnInputChange
        };
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('change', {});
        expect(spyOnInputChange.callCount).toEqual(1);
        tagInput.unmount();
    });

    it('TagInput with onBlur & onFocus', () => {
        const spyOnBlur = sinon.spy(() => { });
        const spyOnFocus = sinon.spy(() => {
        });
        const props = {
            onBlur: spyOnBlur,
            onFocus: spyOnFocus
        };
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('focus', {});
        expect(spyOnFocus.callCount).toEqual(1);
        tagInput.find('input').simulate('blur', {});
        expect(spyOnBlur.callCount).toEqual(1);
        tagInput.unmount();
    });

    it('TagInput with addOnBlur', () => {
        const props = {
            addOnBlur: true,
            defaultValue: ['abc']
        };
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('focus', {});
        tagInput.find('input').simulate('blur', {});
        tagInput.find('input').simulate('change', { target: { value: "hotsoon" } });
        tagInput.find('input').simulate('keyDown', { keyCode: 13 });
        const tags = tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.length).toEqual(2);
        expect(tags.at(1).getDOMNode().textContent).toEqual('hotsoon');
        tagInput.unmount();
    });

    it('tagInput with value controlled mode ', () => {
        const props = {
            value: ['abc']
        };
        const tagInput = getTagInput(props);
        expect(tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`).getDOMNode().textContent).toEqual('abc');
        tagInput.setProps({ value: ['hotsoon'] });
        tagInput.update();
        expect(tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`).getDOMNode().textContent).toEqual('hotsoon');
    });

    it('tagInput with set value to null  ', () => {
        const props = {
            value: ['semi']
        };
        const tagInput = getTagInput(props);
        expect(tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`).getDOMNode().textContent).toEqual('semi');
        tagInput.setProps({ value: null });
        tagInput.update();
        const tags = tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.length).toEqual(0);
    });

    it('tagInput with set value to null  ', () => {
        const props = {
            value: ['semi']
        };
        const tagInput = getTagInput(props);
        expect(tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`).getDOMNode().textContent).toEqual('semi');
        tagInput.setProps({ value: undefined });
        tagInput.update();
        const tags = tagInput.find(`.${BASE_CLASS_PREFIX}-tagInput-wrapper .${BASE_CLASS_PREFIX}-tag-content`);
        expect(tags.length).toEqual(0);
    });

    it('tagInput with inputValue controlled mode ', () => {
        const props = {
            inputValue: 'abc'
        };
        const tagInput = getTagInput(props);
        expect(tagInput.find('input').getDOMNode().value).toEqual('abc');
        tagInput.setProps({ inputValue: 'hotsoon' });
        tagInput.update();
        expect(tagInput.find('input').getDOMNode().value).toEqual('hotsoon');
    })

    it('TagInput with onKeyDown', () => {
        const spyOnKeyDown = sinon.spy(value => { });
        const props = {
            onKeyDown: spyOnKeyDown,
        };
        const tagInput = getTagInput(props);
        tagInput.find('input').simulate('keyDown', { keyCode: 13 });
        expect(spyOnKeyDown.callCount).toEqual(1);
        tagInput.unmount();
    });
})