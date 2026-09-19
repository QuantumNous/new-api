import React from 'react';
import { useForm } from 'react-hook-form';

export function FormSection1({ register }) {
  return (
    <>
      <div>
        <label>First name</label>
        <input
          type="text"
          {...register('firstName', { required: true, maxLength: 80 })}
        />
      </div>
      <div>
        <label>Last name</label>
        <input
          type="text"
          {...register('lastName', { required: true, maxLength: 100 })}
        />
      </div>
    </>
  );
}

export function FormSection2({ register }) {
  return (
    <>
      <div>
        <label>Email</label>
        <input
          type="email"
          {...register('email', {
            required: true,
          })}
        />
      </div>
      <div>
        <label>Mobile number</label>
        <input
          type="tel"
          {...register('mobileNumber', {
            required: true,
            maxLength: 11,
            minLength: 8,
          })}
        />
      </div>
      <div>
        <label>Title</label>
        <select {...register('title', { required: true })}>
          <option value="Mr">Mr</option>
          <option value="Mrs">Mrs</option>
          <option value="Miss">Miss</option>
          <option value="Dr">Dr</option>
        </select>
      </div>

      <div>
        <label>Are you a developer?</label>
        <input
          type="radio"
          value="Yes"
          {...register('developer', { required: true })}
        />
        <input
          type="radio"
          value="No"
          {...register('developer', { required: true })}
        />
      </div>
    </>
  );
}

export default function App() {
  const { register, handleSubmit } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormSection1 register={register} />
      <FormSection2 register={register} />
      <input type="submit" />
    </form>
  );
}
