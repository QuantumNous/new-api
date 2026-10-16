import React from 'react';
import { useForm, NestedValue } from 'react-hook-form';

export default function App() {
  const { register, errors, handleSubmit } = useForm<{
    email: NestedValue<string[]>;
  }>({
    defaultValues: {
      email: ['first@react.hook.form', 'last@react.hook.form'],
    },
  });

  const onSubmit = handleSubmit<{ email: string }>((data) => {
    alert(JSON.stringify(data));
  });

  return (
    <form onSubmit={onSubmit}>
      <label>Native Multiple Input</label>
      <input
        multiple
        type="email"
        name="email"
        list="email"
        ref={register({ required: 'This is required.' })}
      />
      <datalist id="email">
        <option value="first@react.hook.form" />
        <option value="second@react.hook.form" />
        <option value="third@react.hook.form" />
        <option value="last@react.hook.form" />
      </datalist>
      {errors?.email && <p>{errors.email.message}</p>}

      <input type="submit" />
    </form>
  );
}
