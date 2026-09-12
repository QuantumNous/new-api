import React from 'react';
import { Controller, useForm } from 'react-hook-form';

const ParseFormatTextarea = ({ value = [], onChange }) => {
  const [text, setText] = React.useState(value);

  const handleChange = (e) => {
    const value = e.target.value.split('\n');

    setText(e.target.value);
    onChange(value);
  };

  return <textarea onChange={handleChange} value={text} />;
};

export default function App() {
  const { control, handleSubmit } = useForm();
  const onSubmit = (data) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="emails"
        render={ParseFormatTextarea}
        control={control}
        defaultValue={[]}
      />

      <Controller
        name="number"
        render={({ value, onChange }) => (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
          />
        )}
        control={control}
        defaultValue={0}
      />

      <button type="submit">Submit</button>
    </form>
  );
}
