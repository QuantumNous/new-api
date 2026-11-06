import React from 'react';
import { renderToString } from 'react-dom/server';

import { useForm } from '../useForm';
import { Watch } from '../watch';

describe('Watch with SSR', () => {
  it('should be rendered correctly', () => {
    const Component = () => {
      const { control } = useForm({ defaultValues: { foo: 'bar' } });
      return (
        <Watch
          control={control}
          names={['foo']}
          render={([foo]) => <span>{foo}</span>}
        />
      );
    };

    expect(renderToString(<Component />)).toBe('<span>bar</span>');
  });
});
