import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, handleSubmit, setValue } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  return (
    <div className="App">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="firstName">First Name</label>
          <input name="firstName" placeholder="bill" ref={register} />
        </div>

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input name="lastName" placeholder="luo" ref={register} />
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

        <div>
          <label>Is developer?</label>
          <input name="isDeveloper" type="checkbox" ref={register} />
        </div>

        <div>
          <label>Age group</label>
          <select ref={register} name="ageGroup">
            <option value="0">0 - 1</option>
            <option value="1">1 - 100</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setValue('firstName', 'Set value by action');
            setValue('ageGroup', '1');
            setValue('isDeveloper', true);
          }}
        >
          Set All Values
        </button>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
