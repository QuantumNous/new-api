import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { object, array, string } from 'yup';
import { yupResolver } from '@hookform/resolvers';

const validationSchema = object().shape({
  questions: array()
    .of(
      object().shape({
        text: string().required('Some text is required'),
      }),
    )
    .required(),
});

function App() {
  const {
    control,
    register,
    errors,
    clearErrors,
    setValue,
    unregister,
    handleSubmit,
    trigger,
  } = useForm({
    mode: 'onChange',
    resolver: yupResolver(validationSchema),
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'questions',
  });

  const isInitialRender = React.useRef(true);
  const appendQuestion = () => {
    append({
      text: '',
    });

    if (errors.questions?.type === 'min') {
      clearErrors('questions'); // always clear errors when there is add action.
    }
  };

  React.useEffect(() => {
    if (!fields.length && !isInitialRender.current) {
      trigger('questions');
    }

    if (isInitialRender.current) {
      isInitialRender.current = false;
    }
  }, [fields, register, setValue, unregister, trigger]);

  return (
    <form onSubmit={handleSubmit(console.log)}>
      <h1>Yup Validation - Field Array</h1>
      {fields.map((question, questionIndex) => (
        <div key={question.id}>
          <input
            ref={register()}
            name={`questions[${questionIndex}].text`}
            control={control}
            defaultValue=""
          />

          <button
            type="button"
            onClick={() => {
              remove(questionIndex);
              trigger();
            }}
          >
            Remove question {question.id}
          </button>
        </div>
      ))}
      <p>Errors: {JSON.stringify(errors)}</p>
      <button type="button" onClick={appendQuestion}>
        Add question
      </button>
      <input type="submit" />
    </form>
  );
}
