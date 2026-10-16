import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Control, UseFormReturn } from '../types';
import { useForm } from '../useForm';
import noop from '../utils/noop';
import { Watch } from '../watch';

type FormType = {
  foo: string;
  bar: string;
  baz: {
    qux: string;
  };
  quux: number;
  fie: null;
  foe: { qux: number[] };
};

describe('Watch', () => {
  it('should render with default value in useForm', () => {
    let watched;
    const Component = () => {
      const form = useForm<{ test: string }>({
        defaultValues: { test: 'test' },
      });
      return (
        <Watch
          control={form.control}
          render={(value) => {
            watched = value;
            return null;
          }}
        />
      );
    };
    render(<Component />);

    expect(watched).toEqual({ test: 'test' });
  });

  it('should render with default value for single input', () => {
    let watched;
    const Component = () => {
      const form = useForm<{ test: string; test1: string }>({
        defaultValues: {
          test: 'test',
          test1: 'test1',
        },
      });
      return (
        <Watch
          control={form.control}
          names="test"
          render={(value) => {
            watched = value;
            return null;
          }}
        />
      );
    };
    render(<Component />);

    expect(watched).toEqual('test');
  });

  it('should render with default values for array of inputs', () => {
    let watched;
    const Component = () => {
      const form = useForm<{ test: string; test1: string }>({
        defaultValues: {
          test: 'test',
          test1: 'test1',
        },
      });
      return (
        <Watch
          control={form.control}
          names={['test', 'test1']}
          render={(value) => {
            watched = value;
            return null;
          }}
        />
      );
    };
    render(<Component />);

    expect(watched).toEqual(['test', 'test1']);
  });

  it('should render with own default value for single input', () => {
    let watched;
    const Component = () => {
      const form = useForm<{ test: string; test1: string }>({});
      return (
        <Watch
          control={form.control}
          names="test"
          defaultValue="somevalue"
          render={(value) => {
            watched = value;
            return null;
          }}
        />
      );
    };
    render(<Component />);

    expect(watched).toEqual('somevalue');
  });

  it('should render with own default value for array of inputs', () => {
    let watched;
    const Component = () => {
      const form = useForm<{ test: string; test1: string }>({});
      return (
        <Watch
          control={form.control}
          names={['test', 'test1']}
          defaultValue={{ test: 'somevalue', test1: 'somevalue1' }}
          render={(value) => {
            watched = value;
            return null;
          }}
        />
      );
    };
    render(<Component />);

    expect(watched).toEqual(['somevalue', 'somevalue1']);
  });

  it('should render with empty array when watch array fields and no default value', () => {
    let watched;
    const Component = () => {
      const form = useForm<{ test: string }>();
      return (
        <Watch
          control={form.control}
          names={['test']}
          render={(value) => {
            watched = value;
            return null;
          }}
        />
      );
    };
    render(<Component />);

    expect(watched).toEqual([undefined]);
  });

  it('should render with undefined when watch single field and no default value', () => {
    let watched;
    const Component = () => {
      const form = useForm<{ test: string }>();
      return (
        <Watch
          control={form.control}
          names="test"
          render={(value) => {
            watched = value;
            return null;
          }}
        />
      );
    };
    render(<Component />);

    expect(watched).toEqual(undefined);
  });

  it('should subscribe to exact input change', () => {
    const App = () => {
      const { control, register } = useForm();

      return (
        <div>
          <input {...register('test.0.data')} />
          <Watch
            control={control}
            names="test"
            exact={true}
            defaultValue="test"
            render={(value) => <p>{value}</p>}
          />
        </div>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '1234',
      },
    });

    expect(screen.getByText('test')).toBeVisible();
  });

  it('should partial re-render with array name and exact option', async () => {
    type FormInputs = {
      child: string;
      childSecond: string;
      parent: string;
    };

    let childCount = 0;
    let childSecondCount = 0;

    const Child = ({
      register,
      control,
    }: Pick<UseFormReturn<FormInputs>, 'register' | 'control'>) => {
      return (
        <>
          <Watch
            control={control}
            names={['childSecond']}
            render={() => {
              childCount++;
              return null;
            }}
          />
          <input {...register('child')} />
        </>
      );
    };

    const ChildSecond = ({
      register,
      control,
    }: Pick<UseFormReturn<FormInputs>, 'register' | 'control'>) => {
      return (
        <>
          <Watch
            control={control}
            exact={true}
            names={['childSecond']}
            render={() => {
              childSecondCount++;
              return null;
            }}
          />
          <input {...register('childSecond')} />
        </>
      );
    };

    let parentCount = 0;
    const Parent = () => {
      const {
        register,
        handleSubmit,
        control,
        formState: { errors },
      } = useForm<FormInputs>();
      parentCount++;
      return (
        <form onSubmit={handleSubmit(noop)}>
          <>
            <input {...register('parent')} />
            <Child register={register} control={control} />
            <ChildSecond register={register} control={control} />
            <p>{String(errors.parent)}</p>
            <button>submit</button>
          </>
        </form>
      );
    };

    render(<Parent />);

    const childInput = screen.getAllByRole('textbox')[1];
    const childSecondInput = screen.getAllByRole('textbox')[2];

    fireEvent.input(childInput, {
      target: { value: 'test' },
    });

    expect(parentCount).toBe(2);
    expect(childCount).toBe(3);
    expect(childSecondCount).toBe(2);

    parentCount = 0;
    childCount = 0;
    childSecondCount = 0;

    fireEvent.submit(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(parentCount).toBe(1));
    expect(childCount).toBe(1);
    expect(childSecondCount).toBe(1);

    parentCount = 0;
    childCount = 0;
    childSecondCount = 0;

    fireEvent.input(childInput, { target: { value: 'test1' } });

    expect(parentCount).toBe(0);
    expect(childCount).toBe(1);
    expect(childSecondCount).toBe(0);

    parentCount = 0;
    childCount = 0;
    childSecondCount = 0;

    fireEvent.input(childSecondInput, { target: { value: 'test2' } });

    expect(parentCount).toBe(0);
    expect(childCount).toBe(1);
    expect(childSecondCount).toBe(1);
  });

  describe('when disabled prop is used', () => {
    it('should be able to toggle subscription and start with disabled true', async () => {
      type FormValues = {
        test: string;
      };

      const ChildComponent = ({
        control,
      }: {
        control: Control<FormValues>;
      }) => {
        const [disabled, setDisabled] = React.useState(true);

        return (
          <div>
            <button
              onClick={() => {
                setDisabled(!disabled);
              }}
              type={'button'}
            >
              toggle
            </button>
            <Watch
              control={control}
              names="test"
              disabled={disabled}
              render={(test) => {
                return <p>{test}</p>;
              }}
            />
          </div>
        );
      };

      const App = () => {
        const { register, control } = useForm<FormValues>({
          defaultValues: {
            test: 'test',
          },
        });

        return (
          <div>
            <input {...register('test')} />
            <ChildComponent control={control} />
          </div>
        );
      };

      render(<App />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: 'what',
        },
      });

      expect(screen.getByText('test')).toBeVisible();

      fireEvent.click(screen.getByRole('button'));

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: 'what12345',
        },
      });

      expect(screen.getByText('what12345')).toBeVisible();

      fireEvent.click(screen.getByRole('button'));

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: '12345',
        },
      });

      expect(screen.getByText('what12345')).toBeVisible();
    });

    it('should be able to toggle the subscription and start with disabled false', async () => {
      type FormValues = {
        test: string;
      };

      const ChildComponent = ({
        control,
      }: {
        control: Control<FormValues>;
      }) => {
        const [disabled, setDisabled] = React.useState(false);

        return (
          <div>
            <button
              onClick={() => {
                setDisabled(!disabled);
              }}
              type={'button'}
            >
              toggle
            </button>
            <Watch
              control={control}
              names="test"
              disabled={disabled}
              render={(test) => <p>{test}</p>}
            />
          </div>
        );
      };

      const App = () => {
        const { register, control } = useForm<FormValues>({
          defaultValues: {
            test: 'test',
          },
        });

        return (
          <div>
            <input {...register('test')} />
            <ChildComponent control={control} />
          </div>
        );
      };

      render(<App />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: 'what',
        },
      });

      expect(screen.getByText('what')).toBeVisible();

      fireEvent.click(screen.getByRole('button'));

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: 'what12345',
        },
      });

      expect(screen.getByText('what')).toBeVisible();
    });
  });

  describe('compute ', () => {
    it('should only update when value changed within compute', () => {
      type FormValue = {
        test: string;
      };

      let renderCount = 0;

      const Form = () => {
        const methods = useForm<FormValue>({
          defaultValues: { test: '' },
        });

        return (
          <div>
            <input {...methods.register('test')} />
            <Watch
              control={methods.control}
              compute={(data) => data.test?.length > 2}
              render={(watchedValue) => {
                renderCount++;
                return (
                  <>
                    <p>{watchedValue ? 'yes' : 'no'}</p>
                    <p>{renderCount}</p>
                  </>
                );
              }}
            />
          </div>
        );
      };

      render(<Form />);

      screen.getByText('no');

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '12' },
      });

      screen.getByText('no');

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '123' },
      });

      screen.getByText('yes');

      expect(renderCount).toEqual(3);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '12' },
      });

      screen.getByText('no');

      expect(renderCount).toEqual(4);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '1' },
      });

      screen.getByText('no');

      expect(renderCount).toEqual(4);
    });
  });

  it('should pass the values corresponding to the `name` prop to render function', () => {
    const Component = () => {
      const { control, register } = useForm<FormType>();
      return (
        <form>
          <input data-testid="foo" {...register('foo')} />
          <input data-testid="bar" {...register('bar')} />
          <input data-testid="baz_qux" {...register('baz.qux')} />
          <Watch
            control={control}
            names={['foo']}
            render={([foo]) => <span data-testid="fooText">{foo}</span>}
          />
          <Watch
            control={control}
            names={['bar']}
            render={([bar]) => <span data-testid="barText">{bar}</span>}
          />
          <Watch
            control={control}
            names={['baz.qux']}
            render={([bazQux]) => (
              <span data-testid="bazQuxText">{bazQux}</span>
            )}
          />
        </form>
      );
    };

    render(<Component />);

    const fooInput = screen.getByTestId('foo');
    const barInput = screen.getByTestId('bar');
    const bazQuxInput = screen.getByTestId('baz_qux');
    const fooText = screen.getByTestId('fooText');
    const barText = screen.getByTestId('barText');
    const bazQuxText = screen.getByTestId('bazQuxText');

    fireEvent.input(fooInput, { target: { value: 'a' } });
    expect(fooText).toHaveTextContent('a');
    expect(barText).toHaveTextContent('');
    expect(bazQuxText).toHaveTextContent('');

    fireEvent.input(barInput, { target: { value: 'b' } });
    expect(fooText).toHaveTextContent('a');
    expect(barText).toHaveTextContent('b');
    expect(bazQuxText).toHaveTextContent('');

    fireEvent.input(bazQuxInput, { target: { value: 'c' } });
    expect(fooText).toHaveTextContent('a');
    expect(barText).toHaveTextContent('b');
    expect(bazQuxText).toHaveTextContent('c');
  });

  it('should trigger re-render only when the values corresponding to the `name` prop change', async () => {
    const outerCallback = jest.fn();
    const fooCallback = jest.fn();
    const barCallback = jest.fn();
    const bazQuxCallback = jest.fn();

    const OnRender = ({ callback }: { callback: () => void }) => {
      callback();
      return null;
    };

    const Component = () => {
      const { control, register } = useForm<FormType>();
      return (
        <form>
          <input data-testid="foo" {...register('foo')} />
          <input data-testid="bar" {...register('bar')} />
          <input data-testid="baz_qux" {...register('baz.qux')} />
          <OnRender callback={outerCallback} />
          <Watch
            control={control}
            names={['foo']}
            render={() => <OnRender callback={fooCallback} />}
          />
          <Watch
            control={control}
            names={['bar']}
            render={() => <OnRender callback={barCallback} />}
          />
          <Watch
            control={control}
            names={['baz.qux']}
            render={() => <OnRender callback={bazQuxCallback} />}
          />
        </form>
      );
    };

    render(<Component />);

    const fooInput = screen.getByTestId('foo');
    const barInput = screen.getByTestId('bar');
    const bazQuxInput = screen.getByTestId('baz_qux');

    fireEvent.input(fooInput, { target: { value: 'a' } });
    expect(outerCallback).toHaveBeenCalledTimes(2);
    expect(fooCallback).toHaveBeenCalledTimes(3);
    expect(barCallback).toHaveBeenCalledTimes(2);
    expect(bazQuxCallback).toHaveBeenCalledTimes(2);

    fireEvent.input(barInput, { target: { value: 'b' } });
    expect(outerCallback).toHaveBeenCalledTimes(2);
    expect(fooCallback).toHaveBeenCalledTimes(3);
    expect(barCallback).toHaveBeenCalledTimes(3);
    expect(bazQuxCallback).toHaveBeenCalledTimes(2);

    fireEvent.input(bazQuxInput, { target: { value: 'c' } });
    expect(outerCallback).toHaveBeenCalledTimes(2);
    expect(fooCallback).toHaveBeenCalledTimes(3);
    expect(barCallback).toHaveBeenCalledTimes(3);
    expect(bazQuxCallback).toHaveBeenCalledTimes(3);
  });
});
