import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';
import Input from '@material-ui/core/Input';
import Select from 'react-select';
import { Input as StrapInput } from 'reactstrap';

const options = [
  { value: 'chocolate', label: 'Chocolate' },
  { value: 'strawberry', label: 'Strawberry' },
  { value: 'vanilla', label: 'Vanilla' },
];

const MyInput = ({ name, label, register }) => {
  return (
    <>
      <label htmlFor={name}>{label}</label>
      <input name={name} placeholder="Jane" ref={register} />
    </>
  );
};

export default function App() {
  const { register, handleSubmit, setValue } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data, null));
  };
  const [values, setReactSelect] = useState({
    selectedOption: [],
  });

  const handleMultiChange = (selectedOption) => {
    setValue('reactSelect', selectedOption);
    setReactSelect({ selectedOption });
  };

  useEffect(() => {
    register({ name: 'reactSelect' });
  }, []);

  return (
    <div className="App">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Input
            style={{
              marginBottom: '20px',
            }}
            name="HelloWorld"
            inputRef={register}
            placeholder="Material UI - Input"
            inputProps={{
              'aria-label': 'Description',
            }}
          />
        </div>

        <div>
          <StrapInput
            placeholder="Strap - Input"
            name="strapInput"
            innerRef={register}
          />
        </div>

        <div>
          <label className="reactSelectLabel">React select</label>
          <Select
            className="reactSelect"
            name="filters"
            placeholder="Filters"
            value={values.selectedOption}
            options={options}
            onChange={handleMultiChange}
            isMulti
          />
        </div>

        <div>
          <MyInput name="firstName" label="First Name" register={register} />
        </div>

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input name="lastName" placeholder="Luo" ref={register} />
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <input
            name="email"
            placeholder="bluebill1049@hotmail.com"
            type="email"
            ref={register}
          />
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
