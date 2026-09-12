import { expect, vi } from 'vitest';
import { createRenderer, fireEvent, screen } from '@mui/internal-test-utils';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';

describe('<Field.Validity />', () => {
  const { render } = createRenderer();

  describe('validationMode=onSubmit', () => {
    it('should pass validity data', () => {
      const handleValidity = vi.fn();

      render(
        <Form>
          <Field.Root>
            <Field.Control required />
            <Field.Validity>{handleValidity}</Field.Validity>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(null);

      fireEvent.click(screen.getByText('submit'));

      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(false);
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(true);
      expect(handleValidity.mock.lastCall?.[0]).toHaveProperty('transitionStatus');

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'test' } });

      expect(handleValidity.mock.lastCall?.[0].value).toBe('test');
      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(true);
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(false);
    });
  });

  describe('validationMode=onBlur', () => {
    it('should pass validity data', () => {
      const handleValidity = vi.fn();

      render(
        <Field.Root validationMode="onBlur">
          <Field.Control required />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(null);

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.blur(input);

      expect(handleValidity.mock.lastCall?.[0].value).toBe('test');
      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(true);
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(false);
    });

    it('should correctly pass errors when validate function returns a string', () => {
      const handleValidity = vi.fn();

      render(
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Field.Control />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.focus(input);
      fireEvent.blur(input);

      expect(handleValidity.mock.lastCall?.[0].error).toBe('error');
      expect(handleValidity.mock.lastCall?.[0].errors).toEqual(['error']);
    });

    it('should correctly pass errors when validate function returns an array of strings', () => {
      const handleValidity = vi.fn();

      render(
        <Field.Root validationMode="onBlur" validate={() => ['1', '2']}>
          <Field.Control />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.focus(input);
      fireEvent.blur(input);

      expect(handleValidity.mock.lastCall?.[0].error).toBe('1');
      expect(handleValidity.mock.lastCall?.[0].errors).toEqual(['1', '2']);
    });
  });
});
