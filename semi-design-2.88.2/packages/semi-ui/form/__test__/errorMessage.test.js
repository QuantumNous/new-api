import { Form } from '../../index';
import { noop } from 'lodash';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const ErrorMessage = Form.ErrorMessage;

function getEM(props) {
    return mount(<ErrorMessage {...props} />);
}

describe('Form-errorMessage', () => {
    it('className & style', () => {
        const props = {
            className: 'test',
            style: {
                color: 'red',
            },
        };
        const em = getEM(props);
        expect(em.exists('.test')).toEqual(true);
        expect(em.find('.test')).toHaveStyle('color', 'red');
    });

    it('error: string', () => {
        let stringError = 'semi error';
        const props = {
            error: stringError,
        };
        const em = getEM(props);
        expect(em.find(`.${BASE_CLASS_PREFIX}-form-field-error-message span`).text()).toEqual(stringError);
    });
    it('error: stringArray', () => {
        let arrayError = ['length error', 'size error'];
        const props = {
            error: arrayError,
        };
        const em = getEM(props);
        expect(em.find(`.${BASE_CLASS_PREFIX}-form-field-error-message span`).text()).toEqual(arrayError.join(', '));
    });
    it('error: reactNode', () => {
        let node = <div>semi error</div>;
        const props = {
            error: node,
        };
        const em = getEM(props);
        expect(em.find(`.${BASE_CLASS_PREFIX}-form-field-error-message`).contains(node)).toEqual(true);
    });

    it('error: null', () => {
        let arrayError = ['length error', 'size error'];
        const props = {
            error: null,
        };
        const em = getEM(props);
        expect(em.exists(`.${BASE_CLASS_PREFIX}-form-field-error-message`)).toEqual(false);
    });
    // it('showValidateIcon')
    // it('validateStatus')
});
