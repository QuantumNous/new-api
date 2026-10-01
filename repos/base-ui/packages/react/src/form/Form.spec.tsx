import * as React from 'react';
import { expectType } from '#test-utils';
import { Form } from '@base-ui/react/form';

interface Values {
  name: string;
  age: number;
}

<Form<Values>
  onFormSubmit={(values) => {
    expectType<string, typeof values.name>(values.name);
    expectType<number, typeof values.age>(values.age);
    // @ts-expect-error
    values.email.startsWith('a');
  }}
/>;
