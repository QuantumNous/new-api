import React from 'react';
import { useForm, useWatch, Control } from 'react-hook-form';

type FormValues = {
  firstName: string;
  lastName: string;
};

function IsolateReRender({ control }: { control: Control }) {
  const firstName = useWatch<FormValues['firstName']>({
    control,
    name: 'firstName',
    defaultValue: 'default',
  });

  return <div>{firstName}</div>;
}

export default function App() {
  const { register, control, handleSubmit } = useForm<FormValues>();
  const onSubmit = handleSubmit((data) => alert(JSON.stringify(data)));

  return (
    <form onSubmit={onSubmit}>
      <div>
        <label>First Name</label>
        <input ref={register} name="firstName" />
      </div>
      <div>
        <label>Last Name</label>
        <input ref={register} name="lastName" />
      </div>
      <IsolateReRender control={control} />

      <input type="submit" />
    </form>
  );
}
