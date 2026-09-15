import React from 'react';
import { useForm } from 'react-hook-form';

const Input = React.forwardRef(({ name }, ref) => {
  return <input ref={ref} name={name} />;
});

export default function App() {
  const { register, handleSubmit } = useForm();
  const onSubmit = (data, event) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input ref={register} name="firstName" />
      <Input ref={register} name="lastName" />

      <button>Submit</button>
    </form>
  );
}
