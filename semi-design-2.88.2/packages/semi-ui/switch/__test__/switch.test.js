import Switch from '../index';
// import { shallow, mount } from 'enzyme';
// import Enzyme, { shallow, render, mount } from 'enzyme';
// import Adapter from 'enzyme-adapter-react-16';
// Enzyme.configure({
//     adapter: new Adapter()
// });

import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import { wrap } from 'lodash';

let CHECKED_CLS = `.${BASE_CLASS_PREFIX}-switch-checked`;

describe('Switch', () => {
    it('switch with custom className & style', () => {
        const wrapper = mount(<Switch className="test" style={{ color: 'red' }} />);
        expect(wrapper.hasClass('test')).toEqual(true);
        expect(wrapper.find('div.test')).toHaveStyle('color', 'red');
        wrapper
        .find('input')
        .first()
        .simulate('change', {
            target: {
                checked: true,
            },
        });
        wrapper.unmount();
    });

    it('switch checkedText / unchekcedText', () => {
        const checkSwitch = mount(<Switch checkedText='semi' uncheckedText='design' checked={true} />);
        const unCheckSwitch = mount(<Switch checkedText='semi' uncheckedText='design' />);
        expect(checkSwitch.find('.semi-switch-checked-text').text()).toEqual('semi');
        expect(unCheckSwitch.find('.semi-switch-unchecked-text').text()).toEqual('design');
    });

    it('switch disabled when props.disabled', () => {
        const wrapperUnchecked = mount(<Switch disabled />);
        expect(wrapperUnchecked.exists(`.semi-switch-disabled`)).toEqual(true);
        expect(wrapperUnchecked.state('nativeControlDisabled')).toEqual(true);
        wrapperUnchecked.setProps({ disabled: false });
        wrapperUnchecked.update();
        expect(wrapperUnchecked.exists(`.semi-switch-disabled`)).toEqual(false);
        expect(wrapperUnchecked.state('nativeControlDisabled')).toEqual(false);

        const wrapperChecked = mount(<Switch disabled defaultChecked />);
        expect(wrapperChecked.exists(CHECKED_CLS)).toEqual(true);
        expect(wrapperChecked.exists(`.semi-switch-disabled`)).toEqual(true);
        expect(wrapperChecked.state('nativeControlDisabled')).toEqual(true);
        wrapperChecked.setProps({ disabled: false })
        wrapperChecked.update();
        expect(wrapperChecked.exists(`.semi-switch-disabled`)).toEqual(false);
        expect(wrapperChecked.state('nativeControlDisabled')).toEqual(false);
    });

    it('switch onChange', () => {
        let onChange = () => {};
        let spyChange = sinon.spy(onChange);
        const wrapper = mount(<Switch onChange={spyChange} />);
        let input = wrapper.find('input').first();
        let event = { target: { checked: true }};
        input.simulate('change', event)
        expect(spyChange.calledOnce).toEqual(true);
        expect(spyChange.calledWithMatch(true)).toEqual(true);
    });

    it('switch onMouseEnter / onMouseLeave', () => {
        let onMouseEnter = () => {};
        let onMouseLeave = () => {};
        let spyEnter = sinon.spy(onMouseEnter);
        let spyLeave = sinon.spy(onMouseLeave);
        const wrapper = mount(<Switch defaultChecked onMouseEnter={spyEnter} onMouseLeave={spyLeave} />);
        const div = wrapper.find('div.semi-switch').first();
        div.simulate('mouseEnter', {});
        expect(spyEnter.calledOnce).toEqual(true);
        div.simulate('mouseLeave', {});
        expect(spyLeave.calledOnce).toEqual(true);
    });

    it('switch size', () => {
        const largeSwitch = shallow(<Switch size='large' />);
        const defaultSwitch = shallow(<Switch size='default' />);
        const smallSwitch = shallow(<Switch size='small' />);
        expect(smallSwitch.exists('.semi-switch-small')).toEqual(true);
        expect(defaultSwitch.exists('.semi-switch-small')).toEqual(false);
        expect(defaultSwitch.exists('.semi-switch-large')).toEqual(false);
        expect(largeSwitch.exists('.semi-switch-large')).toEqual(true);
    });

    it('switch controlled mode', () => {
        let checked = false;

        let onChange = val => {
            checked = val;
        };

        const spy = sinon.spy(onChange);
        let wrapper = mount(<Switch checked={checked} onChange={spy} />);
        expect(wrapper.exists(CHECKED_CLS)).toEqual(false);

        wrapper
            .find('input')
            .first()
            .simulate('change', {
                target: {
                    checked: true,
                },
            });
        expect(spy.calledOnce).toBe(true);
        expect(checked === true).toEqual(true);

        // !!!important，在回调函数中修改了props.checke的值，不会在已monted的wrapper中生效，需要手动更新一次
        wrapper.setProps({ checked: true });
        // 更新了props之后，实际上在Symbol(enzyme.__node__).rendered.instance.className已有对应的CHECKED_CLS存在，
        // 但不知道为啥，必须手动触发一次update之后，调用exists后才是true，很奇怪
        wrapper.update();

        expect(wrapper.exists(CHECKED_CLS)).toEqual(true);
    });

    it('switch with loading', () => {
        const wrapperLoading = shallow(<Switch loading />);
        expect(wrapperLoading.exists(`.${BASE_CLASS_PREFIX}-switch-loading`)).toEqual(true);
        const wrapper = shallow(<Switch />);
        expect(wrapper.exists(`.${BASE_CLASS_PREFIX}-switch-loading`)).toEqual(false);
    });

});
