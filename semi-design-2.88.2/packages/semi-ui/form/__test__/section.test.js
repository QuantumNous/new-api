import { Form } from '../../index';
import { noop } from 'lodash';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const Section = Form.Section;

function getSection(props) {
    return mount(<Section {...props}></Section>);
}

describe('Form.Label', () => {
    it('className & style', () => {
        let props = {
            className: 'sec-test',
            style: {
                color: 'red',
            },
        };
        const section = getSection(props);
        expect(section.exists('section.sec-test')).toEqual(true);
        expect(section.find('section.sec-test')).toHaveStyle('color', 'red');
    });

    it('children', () => {
        const section = mount(<Form>
            <Section>
                <Form.Input field='test' className='test'></Form.Input>
            </Section>
        </Form>)
        expect(section.exists(`.test`)).toEqual(true);
    });

    it('text', () => {
        let props = {
            text: 'semi',
        };
        const section = getSection(props);
        expect(section.find('.semi-form-section-text').text()).toEqual('semi');
        // text = 0
        section.setProps({ text: 0 });
        section.update();
        expect(section.find('.semi-form-section-text').text()).toEqual('0');
        let text = <div>{'semi'}</div>;
        // text = reactNode
        section.setProps({ text: text });
        section.update();
        expect(section.contains(text)).toEqual(true);
    });
});
