import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';

let renderCounter = 0;

const ManualRegisterForm: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<{
    firstName: string;
    lastName: string;
    min: string;
    max: string;
    minDate: string;
    maxDate: string;
    minLength: string;
    minRequiredLength: string;
    selectNumber: string;
    pattern: string;
    radio: string;
    checkbox: string;
  }>();
  const onSubmit = () => {};
  renderCounter++;

  useEffect(() => {
    register('firstName', { required: true });
    register('lastName', { required: true, maxLength: 5 });
    register('min', { min: 10 });
    register('max', { max: 20 });
    register('minDate', { min: '2019-08-01' });
    register('maxDate', { max: '2019-08-01' });
    register('minLength', { minLength: 2 });
    register('minRequiredLength', { minLength: 2, required: true });
    register('selectNumber', { required: true });
    register('pattern', { pattern: /\d+/ });
    register('radio', { required: true });
    register('checkbox', { required: true });
  }, [register]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
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
      {errors.firstName && <p>firstName error</p>}
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
      {errors.lastName && <p>lastName error</p>}
      <input
        type="number"
        name="min"
        placeholder="min"
        onChange={(e) =>
          setValue('min', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {errors.min && <p>min error</p>}
      <input
        type="number"
        name="max"
        placeholder="max"
        onChange={(e) =>
          setValue('max', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {errors.max && <p>max error</p>}
      <input
        type="date"
        name="minDate"
        placeholder="minDate"
        onChange={(e) =>
          setValue('minDate', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {errors.minDate && <p>minDate error</p>}
      <input
        type="date"
        name="maxDate"
        placeholder="maxDate"
        onChange={(e) =>
          setValue('maxDate', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {errors.maxDate && <p>maxDate error</p>}
      <input
        name="minLength"
        placeholder="minLength"
        onChange={(e) =>
          setValue('minLength', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {errors.minLength && <p>minLength error</p>}
      <input
        name="minRequiredLength"
        placeholder="minRequiredLength"
        onChange={(e) =>
          setValue('minRequiredLength', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {errors.minRequiredLength && <p>minRequiredLength error</p>}
      <select
        name="selectNumber"
        onChange={(e) =>
          setValue('selectNumber', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      >
        <option value="">Select</option>
        <option value={1}>1</option>
        <option value={2}>1</option>
      </select>
      {errors.selectNumber && <p>selectNumber error</p>}
      <input
        name="pattern"
        placeholder="pattern"
        onChange={(e) =>
          setValue('pattern', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {errors.pattern && <p>pattern error</p>}
      Radio1
      <input
        type="radio"
        name="radio"
        value="1"
        onChange={(e) =>
          setValue('radio', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      Radio2
      <input
        type="radio"
        name="radio"
        value="2"
        onChange={(e) =>
          setValue('radio', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      Radio3
      <input
        type="radio"
        name="radio"
        value="3"
        onChange={(e) =>
          setValue('radio', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {errors.radio && <p>radio error</p>}
      <input
        type="checkbox"
        name="checkbox"
        onChange={(e) =>
          setValue('checkbox', e.target.value, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      {errors.checkbox && <p>checkbox error</p>}
      <button id="submit">Submit</button>
      <div id="renderCount">{renderCounter}</div>
    </form>
  );
};

export default ManualRegisterForm;
