import React from 'react';
import { renderToString } from 'react-dom/server';

import { useController } from '../useController';
import { useForm } from '../useForm';
import { FormProvider, useFormContext } from '../useFormContext';
import { useFormState } from '../useFormState';
import { useWatch } from '../useWatch';

describe('FormProvider', () => {
  it('should work correctly with Controller, useWatch, useFormState.', () => {
    const App = () => {
      const { field } = useController({
        name: 'test',
        defaultValue: '',
      });
      return <input {...field} />;
    };

    const TestWatch = () => {
      const value = useWatch({
        name: 'test',
      });

      return <p>{value}</p>;
    };

    const TestFormState = () => {
      const { isDirty } = useFormState();

      return <div>{isDirty ? 'yes' : 'no'}</div>;
    };

    const TestUseFormContext = () => {
      const methods = useFormContext();
      methods.register('test');
      return null;
    };

    const Component = () => {
      const methods = useForm();

      return (
        <FormProvider {...methods}>
          <App />
          <TestUseFormContext />
          <TestWatch />
          <TestFormState />
        </FormProvider>
      );
    };

    const output = renderToString(<Component />);

    expect(output).toEqual('<input name="test" value=""/><p></p><div>no</div>');
  });
});
