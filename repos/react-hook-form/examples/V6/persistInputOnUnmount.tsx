import React from 'react';
import { useForm, useWatch } from 'react-hook-form';

function useInputCache(values, causeField, effectField, callback) {
  const [effectCache, setEffectCache] = React.useState(values[effectField]);

  const evaluateRegStatus = (vals, currentState) => {
    // check if field is registered (naive implementation for demonstration)
    const isRegistered = !!vals[causeField];
    return {
      isRegistered,
      registrationStatusChanged: isRegistered !== currentState,
      hasValue: vals[effectField] !== undefined,
    };
  };

  // use ref to track registration state across renders
  const currentRegState = React.useRef(false);

  React.useEffect(() => {
    const { isRegistered, registrationStatusChanged, hasValue } =
      evaluateRegStatus(values, currentRegState.current);

    if (registrationStatusChanged && hasValue) {
      if (isRegistered && !!effectCache) {
        console.debug('Deploying cache');
        callback(effectField, effectCache);
      } else if (!isRegistered) {
        console.debug('Caching before unmount');
        setEffectCache(values[effectField]);
      }
      currentRegState.current = !!isRegistered;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, causeField, effectField, callback]);
}

export default function App() {
  const { register, handleSubmit, setValue, control } = useForm({
    mode: 'onChange',
    defaultValues: {
      name: '',
      check: false,
      optionalText: '',
    },
  });

  const values = useWatch({
    control,
  });
  useInputCache(values, 'check', 'optionalText', setValue);

  return (
    <div className="App">
      <h1>Here's a form with conditional fields.</h1>
      <form onSubmit={handleSubmit(console.log)}>
        <input
          name={'name'}
          type={'text'}
          ref={register({ required: true, min: 3 })}
          placeholder={'Enter a name'}
        />
        <br />
        <label htmlFor={'check'}>
          toggle field:
          <input
            name={'check'}
            type={'checkbox'}
            ref={register({ required: true })}
          />
        </label>
        <br />
        {values.check && (
          <input
            name={'optionalText'}
            ref={register({ required: false })}
            placeholder={'Mandatory when check=true'}
          />
        )}
      </form>
    </div>
  );
}
