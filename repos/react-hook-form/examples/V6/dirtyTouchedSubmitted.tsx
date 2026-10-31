import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, handleSubmit, formState } = useForm({
    mode: 'onChange',
  });
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  console.log(formState);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>First name</label>
        <input type="text" name="First name" ref={register} />
      </div>
      <div>
        <label>Last name</label>
        <input type="text" name="Last name" ref={register} />
      </div>
      <div>
        <label>Email</label>
        <input type="text" name="Email" ref={register} />
      </div>
      <div>
        <label>Mobile number</label>
        <input type="tel" name="Mobile number" ref={register} />
      </div>
      <div>
        <label>Title</label>
        <select name="Title" ref={register}>
          <option value="Mr">Mr</option>
          <option value="Mrs">Mrs</option>
          <option value="Miss">Miss</option>
          <option value="Dr">Dr</option>
        </select>
      </div>

      <div>
        <label>Are you a developer?</label>
        <input name="developer" type="radio" value="Yes" ref={register} />
        <input name="developer" type="radio" value="No" ref={register} />
      </div>

      <pre>{JSON.stringify(formState, null, 2)}</pre>

      <input type="submit" />
    </form>
  );
}

ReactDOM.render(<Form />, rootElement);
