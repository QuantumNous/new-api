import { Form } from '../../index';

function getFormGroup(props = {}) {
    let {
        inputGroupProps = {},
        fieldAProps = {},
        fieldBProps = {},
        formProps = {},
    } = props;

    return mount(<Form {...formProps}>
        <Form.InputGroup {...inputGroupProps}>
            <Form.Input field='a' {...fieldAProps}></Form.Input>
            <Form.Input field='b' {...fieldBProps}></Form.Input>
        </Form.InputGroup>
    </Form>);
}

describe('Form-group', () => {

    it('error aggregation', () => {
        let errorA = 'fieldAError';
        let errorB = 'fieldBError';
        let props = {
            fieldAProps: {
                validate: () => errorA,
                trigger: 'mount'
            },
            fieldBProps: {
                validate: () => errorB,
                trigger: 'mount'
            }
        };
        let form = getFormGroup(props);
        let errors = form.find('.semi-form-field-error-message span');
        expect(errors.at(1).text()).toEqual(`${errorA}, ${errorB}`);
    });

    it('label-string', () => {
        let props = {
            fieldAProps: { },
            fieldBProps: { },
            inputGroupProps: {
                label: 'semi'
            }
        };
        let form = getFormGroup(props);
        let labelText = form.find('.semi-form-field-label-text').text();
        expect(labelText).toEqual('semi');
    });

    it('label-object', () => {
        let props = {
            fieldAProps: { },
            fieldBProps: { },
            inputGroupProps: {
                label: {
                    text: <span>semi</span>,
                    required: true
                }
            }
        };
        let form = getFormGroup(props);
        expect(form.find('.semi-form-field-label-text').text()).toEqual('semi');
    });

    it('labelPosition', () => {
        let props = {
            fieldAProps: { },
            fieldBProps: { },
            inputGroupProps: {
                label: 'semi',
                labelPosition: 'left'
            }
        };
        let form = getFormGroup(props);
        expect(form.exists('.semi-form-field-label-left')).toEqual(true);
    });

    it('children', () => {
        let props = {
            fieldAProps: {
                
            },
        }
        let form = getFormGroup();
        // exist field a\b and theirs label are hidden
        expect(form.exists('.semi-input-group .semi-form-field-label')).toEqual(false);
    });

    it('decleare labelPosition, labelWidth via form props', () => {
        let props = {
            formProps: {
                labelPosition: 'left',
                labelWidth: 300
            },
            inputGroupProps: {
                label: {
                    text: 'semi'
                }
            }
        };
        let form = getFormGroup(props);
        expect(form.exists('.semi-form-field-label-left')).toEqual(true);
        expect(form.find('.semi-form-field-label')).toHaveStyle('width', 300);
    });

});
