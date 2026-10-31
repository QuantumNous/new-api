import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, watch, handleSubmit } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  const moreDetail = watch('moreDetail');

  return (
    <div className="App">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="firstName">First Name</label>
          <input name="firstName" placeholder="Bill" ref={register} />
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

        <div>
          <label htmlFor="lastName">More Details</label>
          <input name="moreDetail" type="checkbox" ref={register} />
        </div>

        {moreDetail && (
          <div>
            <label>Interests</label>
            <input type="text" name="Interests" ref={register} />
          </div>
        )}
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
