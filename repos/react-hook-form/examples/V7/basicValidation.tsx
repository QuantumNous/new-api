import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

import './styles.css';

export default function Form() {
  const { register, errors, handleSubmit } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };
  console.log(errors);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="firstName">First name</label>
        <input
          id="firstName"
          type="text"
          {...register('firstName', { required: true, maxLength: 80 })}
        />
      </div>
      <div>
        <label htmlFor="lastName">Last name</label>
        <input
          id="lastName"
          type="text"
          {...register('lastName', { required: true, maxLength: 100 })}
        />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="text"
          {...register('email', {
            required: true,
            pattern:
              /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
          })}
        />
      </div>
      <div>
        <label htmlFor="mobileNumber">Mobile number</label>
        <input
          id="mobileNumber"
          type="tel"
          {...register('mobileNumber', {
            required: true,
            maxLength: 11,
            minLength: 8,
          })}
        />
      </div>
      <div>
        <label htmlFor="title">Title</label>
        <select id="title" {...register('title', { required: true })}>
          <option value="Mr">Mr</option>
          <option value="Mrs">Mrs</option>
          <option value="Miss">Miss</option>
          <option value="Dr">Dr</option>
        </select>
      </div>

      <div>
        <fieldset>
          <legend>Are you a developer?</legend>

          <div>
            <input
              id="devYes"
              type="radio"
              value="Yes"
              {...register('developer', { required: true })}
            />
            <label htmlFor="devYes">Yes</label>
          </div>

          <div>
            <input
              id="devNo"
              type="radio"
              value="No"
              {...register('developer', { required: true })}
            />
            <label htmlFor="devNo">No</label>
          </div>
        </fieldset>
      </div>

      <input type="submit" />
    </form>
  );
}
