import React from 'react';
import { useForm } from 'react-hook-form';

let renderCounter = 0;

const ValidateFieldCriteria: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
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
    multiple: string;
    validate: string;
  }>({
    criteriaMode: 'all',
  });
  const onSubmit = () => {};

  renderCounter++;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('firstName', { required: true, minLength: 4 })}
        placeholder="firstName"
      />
      {errors.firstName &&
        errors.firstName.types &&
        errors.firstName.types.required && <p>firstName required</p>}
      {errors.firstName &&
        errors.firstName.types &&
        errors.firstName.types.minLength && <p>firstName minLength</p>}

      {errors.firstName && errors.firstName.types && (
        <b>{errors.firstName.types.required || ''}</b>
      )}

      {errors.firstName && errors.firstName.types && (
        <b>{errors.firstName.types.minLength || ''}</b>
      )}

      <input
        type="number"
        {...register('min', { required: true, min: 10, max: 30 })}
        placeholder="min"
      />
      {errors.min && errors.min.types && errors.min.types.required && (
        <p>min required</p>
      )}
      {errors.min && errors.min.types && errors.min.types.min && <p>min min</p>}
      {errors.min && errors.min.types && errors.min.types.max && <p>min max</p>}
      <input
        type="date"
        {...register('minDate', { required: true, min: '2019-08-01' })}
        placeholder="minDate"
      />
      {errors.minDate &&
        errors.minDate.types &&
        errors.minDate.types.required && <p>minDate required</p>}
      {errors.minDate && errors.minDate.types && errors.minDate.types.min && (
        <p>minDate min</p>
      )}
      <input
        type="date"
        {...register('maxDate', { required: true, max: '2019-08-01' })}
        placeholder="maxDate"
      />
      {errors.maxDate &&
        errors.maxDate.types &&
        errors.maxDate.types.required && <p>maxDate required</p>}
      {errors.maxDate && errors.maxDate.types && errors.maxDate.types.max && (
        <p>maxDate max</p>
      )}
      <input
        {...register('minLength', { required: true, minLength: 2 })}
        placeholder="minLength"
      />
      {errors.minLength &&
        errors.minLength.types &&
        errors.minLength.types.required && <p>minLength required</p>}
      {errors.minLength &&
        errors.minLength.types &&
        errors.minLength.types.minLength && <p>minLength minLength</p>}
      <select {...register('selectNumber', { required: true, minLength: 2 })}>
        <option value="">Select</option>
        <option value="1">1</option>
        <option value="12">2</option>
      </select>
      {errors.selectNumber &&
        errors.selectNumber.types &&
        errors.selectNumber.types.required && <p>selectNumber required</p>}
      {errors.selectNumber &&
        errors.selectNumber.types &&
        errors.selectNumber.types.minLength && <p>selectNumber minLength</p>}
      <input
        {...register('pattern', {
          pattern: /\d+/,
          required: true,
          minLength: 3,
        })}
        placeholder="pattern"
      />
      {errors.pattern &&
        errors.pattern.types &&
        errors.pattern.types.pattern && <p>pattern pattern</p>}
      {errors.pattern &&
        errors.pattern.types &&
        errors.pattern.types.required && <p>pattern required</p>}
      {errors.pattern &&
        errors.pattern.types &&
        errors.pattern.types.minLength && <p>pattern minLength</p>}
      <select
        multiple
        {...register('multiple', {
          required: true,
          validate: (value) => value.includes('optionB'),
        })}
      >
        <option value="optionA">optionA</option>
        <option value="optionB">optionB</option>
      </select>
      {errors.multiple &&
        errors.multiple.types &&
        errors.multiple.types.required && <p>multiple required</p>}
      {errors.multiple &&
        errors.multiple.types &&
        errors.multiple.types.validate && <p>multiple validate</p>}
      <input
        type="validate"
        placeholder="validate"
        {...register('validate', {
          validate: {
            test: (value) => value !== '',
            test1: (value) => value.length > 3,
            test2: (value) => value === 'test',
          },
        })}
      />
      {errors.validate &&
        errors.validate.types &&
        errors.validate.types.test && <p>validate test</p>}
      {errors.validate &&
        errors.validate.types &&
        errors.validate.types.test1 && <p>validate test1</p>}
      {errors.validate &&
        errors.validate.types &&
        errors.validate.types.test2 && <p>validate test2</p>}
      <button id="submit">Submit</button>

      <button
        type="button"
        id="trigger"
        onClick={() => {
          setError('firstName', {
            types: {
              minLength: 'test1',
              required: 'test2',
            },
          });
        }}
      >
        Trigger Error
      </button>

      <button
        type="button"
        id="clear"
        onClick={() => {
          clearErrors('firstName');
        }}
      >
        Clear Error
      </button>
      <div id="renderCount">{renderCounter}</div>
    </form>
  );
};

export default ValidateFieldCriteria;
