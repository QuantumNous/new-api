import React from 'react';
import { useForm } from 'react-hook-form';

let renderCounter = 0;

const ConditionalField: React.FC = () => {
  const {
    register,
    handleSubmit,
    watch,
    formState: {
      dirtyFields,
      isSubmitted,
      submitCount,
      touchedFields,
      isDirty,
      isSubmitting,
      isSubmitSuccessful,
      isValid,
      errors,
    },
  } = useForm<{
    selectNumber: string;
    firstName: string;
    lastName: string;
    min: string;
    max: string;
    notRequired: string;
  }>({
    mode: 'onChange',
  });
  const [result, setResult] = React.useState({});

  const selectNumber = watch('selectNumber');

  renderCounter++;

  return (
    <form
      onSubmit={handleSubmit((data) => {
        setResult(data);
      })}
    >
      <select {...register('selectNumber', { required: true })}>
        <option value="">Select</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
      </select>

      {selectNumber === '1' && (
        <>
          <input
            {...register('firstName', { required: true })}
            placeholder="firstName"
          />
          <input
            {...register('lastName', { required: true })}
            placeholder="lastName"
          />
        </>
      )}

      {selectNumber === '2' && (
        <>
          <input
            type="number"
            {...register('min', { required: true, min: 10 })}
            placeholder="min"
          />
          <input
            type="number"
            {...register('max', { required: true, max: 20 })}
            placeholder="max"
          />
        </>
      )}

      {selectNumber === '3' && (
        <>
          <input {...register('notRequired')} placeholder="notRequired" />
        </>
      )}

      <button id="submit">Submit</button>
      <div id="state">
        {JSON.stringify({
          isSubmitted,
          submitCount,
          isDirty,
          isSubmitting,
          isSubmitSuccessful,
          isValid,
          touched: Object.keys(touchedFields),
          dirty: Object.keys(dirtyFields),
        })}
      </div>
      <div id="result">{JSON.stringify(result)}</div>
      <div id="result">{typeof selectNumber}</div>
      <div id="renderCount">{renderCounter}</div>
    </form>
  );
};

export default ConditionalField;
