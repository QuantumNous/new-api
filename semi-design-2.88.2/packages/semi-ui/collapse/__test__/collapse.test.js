import { Collapse } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants'; // import toJson from 'enzyme-to-json';

import { IconPlus, IconMinus, IconCopy } from '@douyinfe/semi-icons';

let getCollapse = (collapseProps, panel1Props) => {
    let props = collapseProps ? collapseProps : {};
    let panelProps = panel1Props ? panel1Props : {};

    return (
        <Collapse {...collapseProps}>
            <Collapse.Panel header="This is panel header 1" itemKey="1" {...panelProps}>
                <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
            </Collapse.Panel>
            <Collapse.Panel header="This is panel header 2" itemKey="2">
                <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
            </Collapse.Panel>
            <Collapse.Panel header="This is panel header 3" itemKey="3">
                <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
            </Collapse.Panel>
        </Collapse>
    );
};

let collapseCls = `.${BASE_CLASS_PREFIX}-collapse`;
let expandAttr = 'aria-expanded';
describe('Collapse', () => {
    it('Collapse with custom className & style', () => {
        let props = {
            className: 'test',
            style: {
                color: 'red',
            },
        };
        const collapse = shallow(getCollapse(props));
        expect(collapse.exists('.test')).toEqual(true);
        expect(collapse.find('div.test')).toHaveStyle('color', 'red');
    });
    it('Collapse with defaultActiveKey', () => {
        // 直接测试对应dom是否有对应的attribute
        let oneExpandProps = {
            defaultActiveKey: '1',
        };
        let moreExpandProps = {
            defaultActiveKey: ['1', '2'],
        };
        const oneExpand = mount(getCollapse(oneExpandProps));
        const moreExpand = mount(getCollapse(moreExpandProps));

        const oneExpandHeaders = oneExpand.find('.semi-collapse-header');
        expect(oneExpandHeaders.at(0).getDOMNode().getAttribute(expandAttr)).toEqual("true");
        expect(oneExpandHeaders.at(1).getDOMNode().getAttribute(expandAttr)).toEqual("false");
        expect(oneExpandHeaders.at(2).getDOMNode().getAttribute(expandAttr)).toEqual("false");

        const moreExpandHeaders = moreExpand.find('.semi-collapse-header')
        expect(moreExpandHeaders.at(0).getDOMNode().getAttribute(expandAttr)).toEqual("true");
        expect(moreExpandHeaders.at(1).getDOMNode().getAttribute(expandAttr)).toEqual("true");
        expect(moreExpandHeaders.at(2).getDOMNode().getAttribute(expandAttr)).toEqual("false");
    });
    it('Collapse with custom expandIcon / collapseIcon', () => {
        let plusIcon = <IconPlus />;
        let minIcon = <IconMinus />;
        let props = {
            expandIcon: plusIcon,
            collapseIcon: minIcon,
        };
        let collapse = mount(getCollapse(props));
        expect(collapse.props().expandIcon).toEqual(plusIcon);
        expect(collapse.props().collapseIcon).toEqual(minIcon);
        expect(collapse.contains(plusIcon)).toEqual(true);
        expect(collapse.contains(minIcon)).toEqual(false);
        collapse
            .find(`.${BASE_CLASS_PREFIX}-collapse-header`)
            .at(0)
            .simulate('click');
        expect(collapse.contains(minIcon)).toEqual(true);
    });
    it('Collapse with custom extra content', () => {
        let extra1 = '1234';
        let extra2 = <IconCopy />;
        let collapse = mount(
            <Collapse>
                <Collapse.Panel header="This is panel header 1" itemKey="1" extra={extra1}>
                    <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
                </Collapse.Panel>
                <Collapse.Panel header="This is panel header 2" itemKey="2" extra={extra2}>
                    <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
                </Collapse.Panel>
            </Collapse>
        );
        let panels = collapse.find(`.${BASE_CLASS_PREFIX}-collapse-header-right`);
        let panel1 = panels.at(0);
        let panel2 = panels.at(1);
        expect(panel1.contains(extra1)).toEqual(true);
        expect(panel1.contains(extra1)).toEqual(true);
    });
    it('Collapse onChange', () => {
        let onChange = value => {};

        let spyOnChange = sinon.spy(onChange);
        let props = {
            onChange: spyOnChange,
        };
        const collapse = mount(getCollapse(props));
        collapse
            .find(`.${BASE_CLASS_PREFIX}-collapse-header`)
            .at(2)
            .simulate('click');
        expect(spyOnChange.calledWithMatch(['3'])).toBe(true);
        expect(spyOnChange.calledOnce).toBe(true);
    });
    it('expand more than one panel', () => {
        const collapse = mount(getCollapse());
        collapse
            .find(`.${BASE_CLASS_PREFIX}-collapse-header`)
            .at(1)
            .simulate('click');
        collapse
            .find(`.${BASE_CLASS_PREFIX}-collapse-header`)
            .at(2)
            .simulate('click');
        let activeSet = [...collapse.state().activeSet];
        expect(JSON.stringify(activeSet)).toEqual('["2","3"]');
        const headers = collapse.find('.semi-collapse-header');
        expect(headers.at(0).getDOMNode().getAttribute(expandAttr)).toEqual("false");
        expect(headers.at(1).getDOMNode().getAttribute(expandAttr)).toEqual("true");
        expect(headers.at(2).getDOMNode().getAttribute(expandAttr)).toEqual("true");
    });

    it('accordion, Only one expansion is allowed', () => {
        let props = {
            accordion: true,
            defaultActiveKey: ['1', '2'],
        };
        const collapse = mount(getCollapse(props));
        let activeSet = [...collapse.state().activeSet];
        expect(activeSet[0]).toEqual('1');
        // only first key active when accordion is true & defaultActiveKey set more than one key
        const headers = collapse.find('.semi-collapse-header');
        expect(headers.at(0).getDOMNode().getAttribute(expandAttr)).toEqual("true");
        expect(headers.at(1).getDOMNode().getAttribute(expandAttr)).toEqual("false");
        // simulate click panel-3
        collapse.find(`.${BASE_CLASS_PREFIX}-collapse-header`).at(2).simulate('click');
        activeSet = [...collapse.state().activeSet];
        expect(activeSet[0]).toEqual('3');
        expect(headers.at(0).getDOMNode().getAttribute(expandAttr)).toEqual("false");
        expect(headers.at(1).getDOMNode().getAttribute(expandAttr)).toEqual("false");
        expect(headers.at(2).getDOMNode().getAttribute(expandAttr)).toEqual("true");
    });

    it('disable Collapse', () => {
        let props = {
            disabled: true,
        };
        const disabledPanel = mount(getCollapse({}, props));
        expect(disabledPanel.exists('.semi-collapse-header-disabled')).toEqual(true);
    });

    it('hide the panel icon', () => {
        const hidePanelArrow = mount( 
        <Collapse >
            <Collapse.Panel header="This is panel header 1" itemKey="1" showArrow={false}>
                <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
            </Collapse.Panel>
        </Collapse>);
        expect(hidePanelArrow.exists('.semi-collapse-header-icon')).toEqual(false);
    });
});
