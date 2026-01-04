import Button from '../index';
import ButtonGroup from '../index';
import { mount } from 'enzyme';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import { IconEdit } from '@douyinfe/semi-icons';

describe('Button', () => {
    it('button with custom className & style', () => {
        const wrapper = mount(<Button className="test" style={{ color: 'red' }} />);
        expect(wrapper.hasClass('test')).toEqual(true);
        expect(wrapper.find('button').getDOMNode().style.color).toBe('red');
    });

    it(`button with icon`, () => {
        const iconType = `${BASE_CLASS_PREFIX}-icon-edit`;

        const elem2 = mount(<Button icon={<IconEdit />} />);
        expect(elem2.find(`.${iconType}`).length).toBe(1);
    });

    it(`test horizontal padding`, () => {
        const elem = mount(<Button icon={<IconEdit />} noHorizontalPadding />);
        expect(elem.find('button').getDOMNode().style.paddingLeft).toBe('0px');
        expect(elem.find(`button`).getDOMNode().style.paddingRight).toBe('0px');

        const elem2 = mount(<Button icon={<IconEdit />} noHorizontalPadding={['left', 'right']} />);
        expect(elem2.find('button').getDOMNode().style.paddingLeft).toBe('0px');
        expect(elem2.find(`button`).getDOMNode().style.paddingRight).toBe('0px');
    });

    it(`test loading`, () => {
        const elem = mount(<Button icon={<IconEdit />} loading />);
        expect(elem.find({ 'data-icon': 'spin' }).length).toBe(1);
    });

    it('test button type',()=>{
       const testType=(type)=>{
           const elem=mount(<Button htmlType={type}/>);
           expect(elem.find('button').getDOMNode().type).toBe(type);
       }
       testType('button');
       testType('reset');
       testType('submit');
    });

    it(`test position`, () => {
        const elem = mount(<Button icon={<IconEdit />} children={'text'} iconPosition={'right'} />);
        expect(elem.find(`.${BASE_CLASS_PREFIX}-button-content-left`).length).toBe(1);
        expect(elem.find(`.${BASE_CLASS_PREFIX}-button-content-right`).length).toBe(0);
    });

    it(`button group with invalid child`, () => {
        const buttonGroup = mount(
            <ButtonGroup>
                {false}
                {null}
                {undefined}
                {1}
                <Button>查询</Button>
                <Button>剪切</Button>
            </ButtonGroup>
        );
        expect(buttonGroup.getDOMNode().textContent).toEqual('1查询剪切');
    });

    it('button group with custom className & style', () => {
        const wrapper = mount(<ButtonGroup className="test" style={{ color: 'red' }} />);
        expect(wrapper.hasClass('test')).toEqual(true);
        expect(wrapper.find('button').getDOMNode().style.color).toBe('red');
    });
});
