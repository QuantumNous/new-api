import React from 'react';
import { useForm } from 'react-hook-form';

const toggle = (state: boolean) => !state;

export default function DisabledFields() {
  const [formDisabled, setFormDisabled] = React.useState(false);
  const [firstDisabled, setFirstDisabled] = React.useState(false);
  const [secondDisabled, setSecondDisabled] = React.useState(true);
  const { register } = useForm({ disabled: formDisabled });

  return (
    <form>
      <button type="button" onClick={() => setFormDisabled(toggle)}>
        Toggle form
      </button>
      <button type="button" onClick={() => setFirstDisabled(toggle)}>
        Toggle Field 1
      </button>
      <button type="button" onClick={() => setSecondDisabled(toggle)}>
        Toggle Field 2
      </button>

      <input
        placeholder="Field 1"
        {...register('first', { disabled: firstDisabled })}
      />
      <input
        placeholder="Field 2"
        {...register('second', { disabled: secondDisabled })}
      />
    </form>
  );
}
