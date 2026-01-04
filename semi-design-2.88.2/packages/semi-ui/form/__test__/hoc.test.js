import { Form } from '../../index';
import { noop } from 'lodash';

describe('Form-hoc', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
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
    });

    it('withField', () => {});
    it('withField-shouldMemo:false', () => {});
    // it('withFormState', () => {});
    // it('withFormApi', () => {});
});
