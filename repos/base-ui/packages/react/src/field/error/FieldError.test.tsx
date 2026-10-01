import { expect } from 'vitest';
import * as React from 'react';
import { fireEvent, screen, waitFor } from '@mui/internal-test-utils';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<Field.Error />', () => {
  const { render } = createRenderer();

  describeConformance(<Field.Error match />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Field.Root invalid>{node}</Field.Root>);
    },
  }));

  it('should set aria-describedby on the control automatically', async () => {
    await render(
      <Field.Root invalid>
        <Field.Control />
        <Field.Error match>Message</Field.Error>
      </Field.Root>,
    );

    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-describedby',
      screen.getByText('Message').id,
    );
  });

  it('should show error messages by default', async () => {
    await render(
      <Form>
        <Field.Root>
          <Field.Control required />
          <Field.Error>Message</Field.Error>
        </Field.Root>
        <button type="submit">submit</button>
      </Form>,
    );

    expect(screen.queryByText('Message')).toBe(null);

    const input = screen.getByRole<HTMLInputElement>('textbox');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(screen.queryByText('Message')).toBe(null);

    fireEvent.click(screen.getByText('submit'));
    expect(screen.queryByText('Message')).not.toBe(null);
  });

  describe('prop: match', () => {
    it('should only render when `match` matches constraint validation', async () => {
      await render(
        <Form>
          <Field.Root>
            <Field.Control required minLength={2} />
            <Field.Error match="valueMissing">Message</Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      expect(screen.queryByText('Message')).toBe(null);

      fireEvent.click(screen.getByText('submit'));
      expect(screen.queryByText('Message')).not.toBe(null);

      const input = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'a' } });
      expect(screen.queryByText('Message')).toBe(null);

      fireEvent.change(input, { target: { value: '' } });
      expect(screen.queryByText('Message')).not.toBe(null);
    });

    it('should show custom errors', async () => {
      await render(
        <Form>
          <Field.Root validate={() => 'error'}>
            <Field.Control />
            <Field.Error match="customError">Message</Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.blur(input);
      expect(screen.queryByText('Message')).toBe(null);

      fireEvent.click(screen.getByText('submit'));
      expect(screen.queryByText('Message')).not.toBe(null);
    });

    it('uses `match={false}` as the default slot for Form errors', async () => {
      await render(
        <Form errors={{ username: 'Username is reserved' }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" required minLength={8} pattern="[a-z]+" />
            <Field.Error match="valueMissing">Username is required.</Field.Error>
            <Field.Error match="tooShort">Username must be at least 8 characters.</Field.Error>
            <Field.Error match="patternMismatch">
              Username can only include lowercase letters.
            </Field.Error>
            <Field.Error data-testid="default-error" match={false} />
          </Field.Root>
        </Form>,
      );

      expect(screen.queryByText('Username is required.')).toBe(null);
      expect(screen.queryByText('Username must be at least 8 characters.')).toBe(null);
      expect(screen.queryByText('Username can only include lowercase letters.')).toBe(null);
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('uses an omitted `match` as the default slot for Form errors', async () => {
      await render(
        <Form errors={{ username: 'Username is reserved' }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" required minLength={8} pattern="[a-z]+" />
            <Field.Error match="valueMissing">Username is required.</Field.Error>
            <Field.Error match="tooShort">Username must be at least 8 characters.</Field.Error>
            <Field.Error match="patternMismatch">
              Username can only include lowercase letters.
            </Field.Error>
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.queryByText('Username is required.')).toBe(null);
      expect(screen.queryByText('Username must be at least 8 characters.')).toBe(null);
      expect(screen.queryByText('Username can only include lowercase letters.')).toBe(null);
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('uses the Field.Control name fallback for Form errors', async () => {
      await render(
        <Form errors={{ email: 'Email is already taken' }}>
          <Field.Root>
            <Field.Control name="email" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      const control = screen.getByRole('textbox');

      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('default-error')).toHaveTextContent('Email is already taken');

      fireEvent.change(control, { target: { value: 'next@example.com' } });

      expect(control).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('default-error')).toBe(null);
    });

    it('ignores inherited Form error properties', async () => {
      await render(
        <Form errors={{}}>
          <Field.Root name="constructor">
            <Field.Control />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('default-error')).toBe(null);
    });

    it('renders Form error arrays as a list', async () => {
      await render(
        <Form errors={{ username: ['Username is reserved', 'Username is too short'] }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      const list = screen.getByTestId('default-error').querySelector('ul');
      expect(list).not.toBe(null);
      expect(list?.querySelectorAll('li')).toHaveLength(2);
      expect(screen.getByText('Username is reserved')).not.toBe(null);
      expect(screen.getByText('Username is too short')).not.toBe(null);
    });

    it('renders single-item Form error arrays as text', async () => {
      await render(
        <Form errors={{ username: ['Username is reserved'] }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByTestId('default-error').querySelector('ul')).toBe(null);
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('ignores empty Form error arrays', async () => {
      await render(
        <Form errors={{ username: [] }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.queryByTestId('default-error')).toBe(null);
      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    });

    it('uses `match={false}` as the default slot for client validation errors', async () => {
      await render(
        <Form>
          <Field.Root>
            <Field.Control required />
            <Field.Error data-testid="default-error" match={false} />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      expect(screen.queryByTestId('default-error')).toBe(null);

      fireEvent.click(screen.getByText('submit'));

      expect(screen.getByTestId('default-error')).not.toBe(null);
    });

    it('uses the client validation path for specific matches when Form errors are present', async () => {
      await render(
        <Form errors={{ username: 'Username is reserved' }}>
          <Field.Root name="username" validate={() => 'Client validation error'}>
            <Field.Control />
            <Field.Error data-testid="custom-error" match="customError" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      fireEvent.click(screen.getByText('submit'));

      expect(screen.getByTestId('custom-error')).toHaveTextContent('Client validation error');
      expect(screen.getByTestId('custom-error')).not.toHaveTextContent('Username is reserved');
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('always renders the error message when `match` is true', async () => {
      await render(
        <Field.Root>
          <Field.Control required />
          <Field.Error match>Message</Field.Error>
        </Field.Root>,
      );

      expect(screen.queryByText('Message')).not.toBe(null);
    });
  });

  describe.skipIf(isJSDOM)('animations', () => {
    afterEach(() => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('triggers enter animation via data-starting-style when mounting', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      let transitionFinished = false;
      function notifyTransitionFinished() {
        transitionFinished = true;
      }

      const style = `
        .animation-test-error {
          transition: opacity 1ms;
        }

        .animation-test-error[data-starting-style],
        .animation-test-error[data-ending-style] {
          opacity: 0;
        }
      `;

      function Test() {
        const [showError, setShowError] = React.useState(false);

        function handleShowError() {
          setShowError(true);
        }

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={handleShowError}>Show</button>
            <Field.Root>
              <Field.Control required />
              <Field.Error
                className="animation-test-error"
                data-testid="error"
                match={showError}
                onTransitionEnd={notifyTransitionFinished}
              >
                Message
              </Field.Error>
            </Field.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);
      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Show'));

      await waitFor(() => {
        expect(transitionFinished).toBe(true);
      });

      expect(screen.getByTestId('error')).not.toBe(null);
    });

    it('applies data-ending-style before unmount', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-error[data-ending-style] {
          animation: test-anim 1ms;
        }
      `;

      function Test() {
        const [showError, setShowError] = React.useState(true);

        function handleHideError() {
          setShowError(false);
        }

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={handleHideError}>Hide</button>
            <Field.Root>
              <Field.Control required />
              <Field.Error className="animation-test-error" data-testid="error" match={showError}>
                Message
              </Field.Error>
            </Field.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);
      expect(screen.getByTestId('error')).not.toBe(null);

      await user.click(screen.getByText('Hide'));

      await waitFor(() => {
        const error = screen.queryByTestId('error');
        expect(error).not.toBe(null);
        expect(error).toHaveAttribute('data-ending-style');
      });

      await waitFor(() => {
        expect(screen.queryByTestId('error')).toBe(null);
      });
    });
  });
});
