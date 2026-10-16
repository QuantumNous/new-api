import React from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useParams } from 'react-router-dom';

let renderCounter = 0;

const validationSchema = yup
  .object()
  .shape({
    firstName: yup.string().required(),
    lastName: yup.string().max(5).required(),
  })
  .required();

const IsValid: React.FC = () => {
  const { mode, defaultValues } = useParams();
  const isBuildInValidation = mode === 'build-in';
  const [show, setShow] = React.useState(true);
  const {
    register,
    handleSubmit,
    unregister,
    formState: { isValid },
  } = useForm<{
    firstName: string;
    lastName: string;
    hidden: string;
    age: string;
    location: string;
    select: string;
    radio: string;
    checkbox: string;
  }>({
    mode: 'onChange',
    ...(isBuildInValidation ? {} : { resolver: yupResolver(validationSchema) }),
    ...(defaultValues === 'defaultValues'
      ? {
          defaultValues: {
            firstName: 'test',
            lastName: 'test1',
          },
        }
      : {}),
  });

  React.useEffect(() => {
    if (isBuildInValidation) {
      if (show) {
        unregister('hidden');
      }
    } else {
      if (!show) {
        unregister('firstName');
      }
    }
  }, [show, isBuildInValidation, unregister]);

  renderCounter++;

  return (
    <form onSubmit={handleSubmit(() => {})}>
      {isBuildInValidation ? (
        <>
          <input {...register('location')} placeholder="location" />
          <input
            {...register('firstName', { required: true })}
            placeholder="firstName"
          />
          <input
            {...register('lastName', { required: true })}
            placeholder="lastName"
          />
          {!show && (
            <input
              {...register('hidden', { required: true })}
              placeholder="hidden"
            />
          )}
          <input {...register('age')} placeholder="age" />
        </>
      ) : (
        <>
          <input {...register('location')} placeholder="location" />
          {show && <input {...register('firstName')} placeholder="firstName" />}
          <input {...register('lastName')} placeholder="lastName" />
          <input {...register('age')} placeholder="age" />
        </>
      )}
      <div id="isValid">{JSON.stringify(isValid)}</div>
      <div id="renderCount">{renderCounter}</div>

      <button
        type="button"
        id="toggle"
        onClick={() => {
          setShow(!show);
        }}
      >
        Toggle
      </button>
    </form>
  );
};

export default IsValid;
