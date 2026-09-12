import React, { useState } from 'react';
import { useForm, ValidationMode } from 'react-hook-form';
import { useParams } from 'react-router-dom';

let renderCounter = 0;

const Basic: React.FC = () => {
  const { mode } = useParams();
  const [data, setData] = React.useState({});
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<{
    firstName: string;
    lastName: string;
    min: string;
    max: string;
    minDate: string;
    maxDate: string;
    minLength: string;
    minRequiredLength: string;
    selectNumber: string;
    pattern: string;
    radio: string;
    checkbox: string;
    checkboxArray: string[];
    multiple: string;
    validate: string;
    nestItem: {
      nest1: string;
    };
    arrayItem: { test1: string; test2: string }[];
  }>({
    mode: mode as keyof ValidationMode,
  });
  const [onInvalidCalledTimes, setOnInvalidCalledTimes] = useState(0);
  const onInvalid = () => setOnInvalidCalledTimes((prevCount) => prevCount + 1);

  renderCounter++;

  return (
    <form
      onSubmit={handleSubmit((data) => {
        setData(data);
      }, onInvalid)}
    >
      <input
        placeholder="nestItem.nest1"
        {...register('nestItem.nest1', { required: true })}
      />
      {errors.nestItem?.nest1 && <p>nest 1 error</p>}
      <input
        placeholder="arrayItem[0].test1"
        {...register('arrayItem.0.test1', { required: true })}
      />
      {errors.arrayItem?.[0]?.test1 && <p>array item 1 error</p>}
      <input
        {...register('firstName', { required: true })}
        placeholder="firstName"
      />
      {errors.firstName && <p>firstName error</p>}
      <input
        {...register('lastName', { required: true, maxLength: 5 })}
        placeholder="lastName"
      />
      {errors.lastName && <p>lastName error</p>}
      <input
        type="number"
        {...register('min', { min: 10 })}
        placeholder="min"
      />
      {errors.min && <p>min error</p>}
      <input
        type="number"
        {...register('max', { max: 20 })}
        placeholder="max"
      />
      {errors.max && <p>max error</p>}
      <input
        type="date"
        {...register('minDate', { min: '2019-08-01' })}
        placeholder="minDate"
      />
      {errors.minDate && <p>minDate error</p>}
      <input
        type="date"
        {...register('maxDate', { max: '2019-08-01' })}
        placeholder="maxDate"
      />
      {errors.maxDate && <p>maxDate error</p>}
      <input
        {...register('minLength', { minLength: 2 })}
        placeholder="minLength"
      />
      {errors.minLength && <p>minLength error</p>}
      <input
        {...register('minRequiredLength', { minLength: 2, required: true })}
        placeholder="minRequiredLength"
      />
      {errors.minRequiredLength && <p>minRequiredLength error</p>}
      <select {...register('selectNumber', { required: true })}>
        <option value="">Select</option>
        <option value={'1'}>1</option>
        <option value={'2'}>2</option>
      </select>
      {errors.selectNumber && <p>selectNumber error</p>}
      <input
        {...register('pattern', { pattern: /\d+/ })}
        placeholder="pattern"
      />
      {errors.pattern && <p>pattern error</p>}
      Radio1
      <input type="radio" {...register('radio')} value="1" />
      Radio2
      <input type="radio" value="2" {...register('radio')} />
      Radio3
      <input
        type="radio"
        value="3"
        {...register('radio', { required: true })}
      />
      {errors.radio && <p>radio error</p>}
      <input type="checkbox" {...register('checkbox', { required: true })} />
      {errors.checkbox && <p>checkbox error</p>}
      <input
        type="checkbox"
        value="1"
        {...register('checkboxArray', { required: true })}
      />
      <input
        type="checkbox"
        value="2"
        {...register('checkboxArray', { required: true })}
      />
      <input
        type="checkbox"
        value="3"
        {...register('checkboxArray', { required: true })}
      />
      {errors.checkboxArray && <p>checkboxArray error</p>}
      <select multiple {...register('multiple', { required: true })}>
        <option value="optionA">optionA</option>
        <option value="optionB">optionB</option>
      </select>
      {errors.multiple && <p>multiple error</p>}
      <input
        type="validate"
        placeholder="validate"
        {...register('validate', {
          validate: (value) => value === 'test',
        })}
      />
      {errors.validate && <p>validate error</p>}
      <button id="submit">Submit</button>
      <button type="button" id="resetForm" onClick={() => reset()}>
        Reset
      </button>
      <div id="renderCount">{renderCounter}</div>
      <div id="on-invalid-called-times">
        onInvalid callback called {onInvalidCalledTimes} times
      </div>
      <pre>{JSON.stringify(data)}</pre>
    </form>
  );
};

export default Basic;
