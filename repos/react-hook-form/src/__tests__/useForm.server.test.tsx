import React from 'react';
import { renderToString } from 'react-dom/server';

import { useForm } from '../useForm';

describe('useForm with SSR', () => {
  it('should not output error', () => {
    const Component = () => {
      const { register } = useForm<{
        test: string;
      }>();
      return (
        <div>
          <input {...register('test')} />
        </div>
      );
    };

    const spy = jest.spyOn(console, 'error');

    expect(renderToString(<Component />)).toEqual(
      '<div><input name="test"/></div>',
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it('should display error with errors prop', () => {
    const App = () => {
      const {
        register,
        formState: { errors },
      } = useForm<{
        test: string;
      }>({
        errors: {
          test: { type: 'test', message: 'test error' },
        },
      });

      return (
        <div>
          <input {...register('test')} />
          <span role="alert">{errors.test && errors.test.message}</span>
        </div>
      );
    };

    expect(renderToString(<App />)).toEqual(
      '<div><input name="test"/><span role="alert">test error</span></div>',
    );
  });

  it('should not pass down constrained API for server side rendering', () => {
    const App = () => {
      const { register } = useForm<{
        test: string;
      }>();

      return (
        <div>
          <input
            {...register('test', {
              required: true,
              min: 2,
              max: 2,
              maxLength: 2,
              minLength: 2,
            })}
          />
        </div>
      );
    };

    expect(renderToString(<App />)).toEqual('<div><input name="test"/></div>');
  });

  it('should pass down constrained API for server side rendering', () => {
    const App = () => {
      const { register } = useForm<{
        test: string;
      }>({
        shouldUseNativeValidation: true,
      });

      return (
        <div>
          <input
            {...register('test', {
              required: true,
              min: 2,
              max: 2,
              maxLength: 2,
              minLength: 2,
            })}
          />
        </div>
      );
    };

    expect(renderToString(<App />)).toEqual('<div><input name="test"/></div>');
  });

  it('should support progress enhancement for form', () => {
    const App = () => {
      const { register } = useForm<{
        test: string;
      }>({
        progressive: true,
      });

      return (
        <div>
          <input
            {...register('test', {
              required: true,
              min: 2,
              max: 2,
              maxLength: 2,
              minLength: 2,
            })}
          />
        </div>
      );
    };

    expect(renderToString(<App />)).toEqual(
      '<div><input required="" min="2" max="2" minLength="2" maxLength="2" name="test"/></div>',
    );
  });
});
