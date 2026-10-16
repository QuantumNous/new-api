import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';

const SetValueAsyncStrictMode = () => {
  const state = React.useRef(new Set());
  const [, update] = React.useState({});
  const { register, setValue, control } = useForm<{
    firstName: string;
  }>();

  useEffect(() => {
    setTimeout(() => {
      setValue('firstName', 'A');
    }, 10);

    setTimeout(() => {
      setValue('firstName', 'B', { shouldDirty: true });
    }, 20);

    setTimeout(() => {
      setValue('firstName', 'C', { shouldTouch: true });
    }, 30);

    setTimeout(() => {
      setValue('firstName', 'D', { shouldValidate: true });
    }, 40);
  }, [register, setValue]);

  return (
    <React.StrictMode>
      <form>
        <Controller
          defaultValue={'test'}
          control={control}
          render={({ field }) => {
            state.current.add(field.value);
            return <input id={'input'} {...field} />;
          }}
          name={'firstName'}
        />

        <button id="submit" type={'button'} onClick={() => update({})}>
          Submit
        </button>

        <p id="result">{JSON.stringify([...state.current])}</p>
      </form>
    </React.StrictMode>
  );
};

export default SetValueAsyncStrictMode;
