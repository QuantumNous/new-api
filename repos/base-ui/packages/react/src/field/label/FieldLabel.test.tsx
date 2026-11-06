import { expect } from 'vitest';
import { Field } from '@base-ui/react/field';
import { screen } from '@mui/internal-test-utils';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Field.Label />', () => {
  const { render } = createRenderer();

  describeConformance(<Field.Label />, () => ({
    refInstanceof: window.HTMLLabelElement,
    testRenderPropWith: 'label',
    render(node) {
      return render(<Field.Root>{node}</Field.Root>);
    },
  }));

  it('should set htmlFor referencing the control automatically', async () => {
    await render(
      <Field.Root data-testid="field">
        <Field.Control />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>,
    );

    expect(screen.getByTestId('label')).toHaveAttribute('for', screen.getByRole('textbox').id);
  });

  it('when nativeLabel={false}, clicking focuses the associated control', async () => {
    const { user } = await render(
      <Field.Root>
        <Field.Control data-testid="control" />
        <Field.Label nativeLabel={false} render={<div />} data-testid="label">
          Label
        </Field.Label>
      </Field.Root>,
    );

    const label = screen.getByTestId('label');
    const control = screen.getByTestId('control');

    expect(label).not.toHaveAttribute('for');

    await user.click(label);
    expect(control).toHaveFocus();
  });

  it('reflects the disabled state from Field.Item', async () => {
    await render(
      <Field.Root>
        <Field.Item disabled>
          <Field.Label data-testid="label">Label</Field.Label>
        </Field.Item>
      </Field.Root>,
    );

    expect(screen.getByTestId('label')).toHaveAttribute('data-disabled');
  });

  describe('dev warnings', () => {
    it('does not warn by default', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      await render(
        <Field.Root>
          <Field.Control />
          <Field.Label>Label</Field.Label>
        </Field.Root>,
      );

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('errors if nativeLabel=true but ref is not a label', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      await render(
        <Field.Root>
          <Field.Control />
          <Field.Label nativeLabel render={<div />}>
            Label
          </Field.Label>
        </Field.Root>,
      );

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Base UI: <Field.Label> expected a <label> element because the `nativeLabel` prop is true. ' +
            'Rendering a non-<label> disables native label association, so `htmlFor` will not ' +
            'work. Use a real <label> in the `render` prop, or set `nativeLabel` to `false`.',
        ),
      );
      errorSpy.mockRestore();
    });

    it('errors if nativeLabel=false but ref is a label', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      await render(
        <Field.Root>
          <Field.Control />
          <Field.Label nativeLabel={false}>Label</Field.Label>
        </Field.Root>,
      );

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Base UI: <Field.Label> expected a non-<label> element because the `nativeLabel` prop is false. ' +
            'Rendering a <label> assumes native label behavior while Base UI treats it as ' +
            'non-native, which can cause unexpected pointer behavior. Use a non-<label> in the ' +
            '`render` prop, or set `nativeLabel` to `true`.',
        ),
      );
      errorSpy.mockRestore();
    });
  });
});
