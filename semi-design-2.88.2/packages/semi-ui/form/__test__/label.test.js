import { Form } from '../../index';
import { noop } from 'lodash';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const Label = Form.Label;

function getLabel(props) {
    return mount(<Label {...props}></Label>);
}

describe('Form.Label', () => {
    it('className & style', () => {
        let props = {
            className: 'label-test',
            style: {
                color: 'red',
            },
        };
        const label = getLabel(props);
        expect(label.exists('label.label-test')).toEqual(true);
        expect(label.find('label.label-test')).toHaveStyle('color', 'red');
    });

    it('required', () => {
        let props = {
            required: true,
        };
        const label = getLabel(props);
        expect(label.exists(`.${BASE_CLASS_PREFIX}-form-field-label-required`)).toEqual(true);
    });

    it('text', () => {
        let props = {
            text: 'semi',
        };
        const label = getLabel(props);
        expect(label.text()).toEqual('semi');
        // text = 0
        label.setProps({ text: 0 });
        label.update();
        expect(label.text()).toEqual('0');
        let text = <div>{'semi'}</div>;
        // text = reactNode
        label.setProps({ text: text });
        label.update();
        expect(label.contains(text)).toEqual(true);
    });
    it('text-align', () => {
        let props = {
            align: 'right',
        };
        const label = getLabel(props);
        expect(label.exists(`.${BASE_CLASS_PREFIX}-form-field-label-right`)).toEqual(true);
    });
    it('width', () => {
        let props = {
            width: 200,
        };
        const label = getLabel(props);
        expect(label.find(`.${BASE_CLASS_PREFIX}-form-field-label`)).toHaveStyle('width', 200);
    });
    it('disabled', () => {
        let props = {
            disabled: true,
        };
        const label = getLabel(props);
        expect(label.exists(`.${BASE_CLASS_PREFIX}-form-field-label-disabled`)).toEqual(true);
    });
});
