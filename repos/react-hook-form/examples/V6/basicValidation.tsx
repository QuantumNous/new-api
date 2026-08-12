import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, errors, handleSubmit } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };
  console.log(errors);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>First name</label>
        <input
          type="text"
          name="First name"
          ref={register({ required: true, maxLength: 80 })}
        />
      </div>
      <div>
        <label>Last name</label>
        <input
          type="text"
          name="Last name"
          ref={register({ required: true, maxLength: 100 })}
        />
      </div>
      <div>
        <label>Email</label>
        <input
          type="text"
          name="Email"
          ref={register({
            required: true,
            pattern:
              /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
          })}
        />
      </div>
      <div>
        <label>Mobile number</label>
        <input
          type="tel"
          name="Mobile number"
          ref={register({ required: true, maxLength: 11, minLength: 8 })}
        />
      </div>
      <div>
        <label>Title</label>
        <select name="Title" ref={register({ required: true })}>
          <option value="Mr">Mr</option>
          <option value="Mrs">Mrs</option>
          <option value="Miss">Miss</option>
          <option value="Dr">Dr</option>
        </select>
      </div>

      <div>
        <label>Are you a developer?</label>
        <input type="radio" value="Yes" ref={register({ required: true })} />
        <input type="radio" value="No" ref={register({ required: true })} />
      </div>

      <div>
        <input type="text" name="asdasd" ref={register} />
      </div>

      <input type="submit" />
    </form>
  );
}

ReactDOM.render(<Form />, rootElement);
