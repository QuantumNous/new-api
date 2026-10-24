import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';

let renderCounter = 0;

const SetValueWithTrigger: React.FC = () => {
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<{
    firstName: string;
    lastName: string;
  }>();

  useEffect(() => {
    register('firstName', {
      required: 'required',
      minLength: {
        value: 10,
        message: 'minLength 10',
      },
    });
    register('lastName', {
      validate: (data) => {
        if (data === 'bill') {
          return true;
        }

        if (data && data.length < 10) {
          return 'too short';
        }

        return 'error message';
      },
    });
  }, [register]);

  renderCounter++;

  return (
    <form onSubmit={handleSubmit(() => {})}>
      <input
        name="firstName"
        placeholder="firstName"
        onChange={(e) =>
          setValue('firstName', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {errors.firstName && <p>{errors.firstName.message}</p>}

      <input
        name="lastName"
        placeholder="lastName"
        onChange={(e) =>
          setValue('lastName', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {errors.lastName && <p>{errors.lastName.message}</p>}

      <button>Submit</button>
      <div id="renderCount">{renderCounter}</div>
    </form>
  );
};

export default SetValueWithTrigger;
