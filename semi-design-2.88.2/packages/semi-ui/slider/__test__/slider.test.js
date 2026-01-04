import Slider from '..';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import isEqual from 'lodash/isEqual';

// TODO 细化单测，目前覆盖的场景过少

describe('Slider', () => {
    it('default value & default range value', () => {
        const wrapper = mount(
            <div>
                <div>Default</div>
                <Slider defaultValue={10} showBoundary={true}></Slider>
                <Slider defaultValue={[20, 60]} range></Slider>
            </div>
        );

        const handles =wrapper.find(`.${BASE_CLASS_PREFIX}-slider-handle`);
        expect(handles.at(0).getDOMNode().style.left).toBe('10%');
        expect(handles.at(1).getDOMNode().style.left).toBe('20%');
        expect(handles.at(2).getDOMNode().style.left).toBe('60%');
        const sliders = wrapper.find(Slider);
        expect(sliders.at(0).state('currentValue')).toBe(10);
        expect(isEqual(sliders.at(1).state('currentValue'), [20, 60])).toBe(true);
        wrapper.unmount();
    });

    // it('onChange', () => {
    //     const onChange = sinon.spy();
    //     const STYLE = { width: 100, height: 32, marginLeft: 13 }; // it is really hack to mock slider wrapper getBoundingClientRect data
    //     const wrapper = mount(<Slider style={STYLE} step={1} onChange={onChange}></Slider>);
    //
    //     const rail = wrapper.find('.semi-slider-rail');
    //     const railNode = rail.getDOMNode();
    //
    //     // click max position
    //     rail.simulate('click', { pageX: 113, pageY: 16, target: railNode }); // these value calculate from storybook, and simulate here
    //     expect(wrapper.state('currentValue')).toBe(100);
    //     expect(onChange.calledOnce).toBe(true);
    //     // click min position
    //     rail.simulate('click', { pageX: 13, pageY: 16, target: railNode });
    //     expect(wrapper.state('currentValue')).toBe(0);
    //     expect(onChange.getCall(1).args[0]).toBe(0);
    // });

    // it('range onChange', () => {
    //     const onChange = sinon.spy();
    //     const STYLE = { width: 4, height: 400, marginLeft: 20, marginTop: 40 }; // it is really hack to mock slider wrapper getBoundingClientRect data
    //     const wrapper = mount(<Slider range vertical defaultValue={[20, 60]} style={STYLE} onChange={onChange}></Slider>);
    //
    //     const rail = wrapper.find('.semi-slider-rail');
    //     const railNode = rail.getDOMNode();
    //
    //     // click min position
    //     rail.simulate('click', { pageX: 22, pageY: 40, target: railNode }); // these value calculate from storybook, and simulate here
    //     expect(isEqual(wrapper.state('currentValue'), [0, 60])).toBe(true);
    //     expect(onChange.calledOnce).toBe(true);
    //     // click max position
    //     rail.simulate('click', { pageX: 22, pageY: 440, target: railNode });
    //     expect(isEqual(wrapper.state('currentValue'), [0, 100])).toBe(true);
    //     expect(isEqual(onChange.getCall(1).args[0], [0, 100])).toBe(true);
    // });

    it('controlled value', () => {
        const onChange = sinon.spy();
        const wrapper = mount(<Slider value={10} step={1} onChange={onChange}></Slider>);

        expect(wrapper.state('currentValue')).toBe(10);
        wrapper.setProps({ 'value': 20 });
        expect(wrapper.state('currentValue')).toBe(20);
        wrapper.setProps({ 'value': 100 + 1 })
        expect(wrapper.state('currentValue')).toBe(100);
        wrapper.unmount();
    });

    // TODO: body event not work
    // it('drag and move', () => {
    //     const STYLE = { width: 100, height: 32, marginLeft: 13 }; // it is really hack to mock slider wrapper getBoundingClientRect data
    //     const wrapper = mount(<Slider style={STYLE} step={1}></Slider>);

    //     const handle = wrapper.find('.semi-slider-handle');
    //     const handleNode = handle.getDOMNode();
    //     handle.simulate('mousedown', { pageX: 13, pageY: 16, target: handleNode }); // these value calculate from storybook, and simulate here
    //     document.dispatchEvent(new Event('mousemove', { pageX: 55, pageY: 16, target: handleNode, bubbles: true }));
    //     document.dispatchEvent(new Event('mouseup', { pageX: 55, pageY: 16, target: handleNode, bubbles: true }));
    //     handle.simulate('mouseup', { pageX: 55, pageY: 16, target: handleNode }); // these value calculate from storybook, and simulate here
    //     expect(wrapper.state('currentValue')).toBe(54);
    // });

    it('when hover into slider', () => {
        let wrapper = mount(<Slider showBoundary={true} />);
        wrapper
            .find(`.${BASE_CLASS_PREFIX}-slider-wrapper`)
            .at(0)
            .simulate('mouseEnter');
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-slider-boundary`)
                .at(0)
                .hasClass(`${BASE_CLASS_PREFIX}-slider-boundary-show`)
        ).toEqual(true);
        wrapper
            .find(`.${BASE_CLASS_PREFIX}-slider-wrapper`)
            .at(0)
            .simulate('mouseLeave');
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-slider-boundary`)
                .at(0)
                .hasClass(`${BASE_CLASS_PREFIX}-slider-boundary-show`)
        ).toEqual(false);
    });

    it('when range is true or defaultValue is array', () => {
        let wrapper = shallow(<Slider range defaultValue={[1, 29]} />);
        let wrapper2 = shallow(<Slider range />);
        expect(wrapper.find(`.${BASE_CLASS_PREFIX}-slider-handle`).length === 2).toEqual(true);
        expect(wrapper2.find(`.${BASE_CLASS_PREFIX}-slider-handle`).length === 2).toEqual(true);
        expect(wrapper.state().currentValue).toEqual([1, 29]);
    });

    it('has marks', () => {
        let wrapper = shallow(<Slider marks={{ 20: '20c', 40: '40c' }} defaultValue={[0, 100]} range />);
        expect(wrapper.exists(`.${BASE_CLASS_PREFIX}-slider-dot`)).toBe(true);
    });

    // it('marks clickable', () => {
    //     const STYLE = { width: 100, height: 32 }; // it is really hack to mock slider wrapper getBoundingClientRect data
    //     let slider = mount(<Slider style={STYLE} marks={{ 20: '20c', 40: '40c' }} defaultValue={[0, 100]} range />);
    //     expect(slider.exists(`.${BASE_CLASS_PREFIX}-slider-dot`)).toBe(true);
    //     expect(slider.state('currentValue')).toEqual([0, 100])
    //     slider.find(`.${BASE_CLASS_PREFIX}-slider-dot`).at(0).simulate('click', {pageX: 20 })
    //     expect(slider.state('currentValue')).toEqual([20, 100])
    // });

    it('when tooltipVisible is true, tooltip should show always, or should never show', () => {
        let wrapper = mount(<Slider defaultValue={30} tooltipVisible />);
        expect(wrapper.exists(`.${BASE_CLASS_PREFIX}-tooltip-wrapper`)).toBe(true);
        wrapper.find(`.${BASE_CLASS_PREFIX}-slider-handle`).at(0).simulate('mouseEnter');
        expect(wrapper.exists(`.${BASE_CLASS_PREFIX}-tooltip-wrapper`)).toBe(true);
        wrapper = mount(<Slider defaultValue={30} tooltipVisible={null} />);
        expect(wrapper.exists(`.${BASE_CLASS_PREFIX}-tooltip-wrapper`)).toBe(false);
    });

    it('disabled', () => {
        let wrapper = shallow(<Slider disabled defaultValue={10} />);
        expect(wrapper.exists(`.${BASE_CLASS_PREFIX}-slider-disabled`)).toBe(true);
        wrapper.setProps({ disabled: false });
        expect(wrapper.exists(`.${BASE_CLASS_PREFIX}-slider-disabled`)).toBe(false);
    });
});
