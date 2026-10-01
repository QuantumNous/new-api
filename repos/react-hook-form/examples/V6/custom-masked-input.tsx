import React from 'react';
import { useForm } from 'react-hook-form';

export const maskPhoneNumber = (phone) => {
  //Example: 0(999) 999 99 99
  const x = phone
    .replace(/\D/g, '')
    .match(/(\d?)(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
  return !x[3]
    ? x[1] + x[2]
    : `${x[1]}(${x[2]}) ${x[3]}${x[4] ? ` ${x[4]}` : ''}${
        x[5] ? ` ${x[5]}` : ''
      }`;
};

export default function App() {
  const { register, handleSubmit, setValue } = useForm();
  const onSubmit = (data) => console.log(data);

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <input
        type="tel"
        name="phoneNumber"
        ref={register}
        onChange={(e) =>
          setValue('phoneNumber', maskPhoneNumber(e.target.value))
        }
      />
      <button>Submit</button>
    </Form>
  );
}
