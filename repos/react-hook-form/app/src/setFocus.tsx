import React from 'react';
import { useForm } from 'react-hook-form';
import type { DefaultValues } from 'react-hook-form';

type FormValues = {
  focusInput: string;
  selectInputContent: string;
  focusTextarea: string;
  selectTextareaContent: string;
};

const defaultValues: DefaultValues<FormValues> = {
  focusInput: 'Input should be focused',
  selectInputContent: 'Content should be selected',
  focusTextarea: 'Textarea should be focused',
  selectTextareaContent: 'Content should be selected',
};

const SetFocus = () => {
  const { register, setFocus } = useForm<FormValues>({
    defaultValues,
  });

  return (
    <form>
      <fieldset>
        <legend>Focus input</legend>
        <label htmlFor="focusInput">Focus Input</label>
        <input id="focusInput" {...register('focusInput')} />
        <button type="button" onClick={() => setFocus('focusInput')}>
          Focus Input
        </button>
      </fieldset>
      <fieldset>
        <legend>Select input content on focus</legend>
        <label htmlFor="selectInputContent">Select Content</label>
        <input id="selectInputContent" {...register('selectInputContent')} />
        <button
          type="button"
          onClick={() => setFocus('selectInputContent', { shouldSelect: true })}
        >
          Select Input Content
        </button>
      </fieldset>
      <fieldset>
        <legend>Focus textarea</legend>
        <label htmlFor="focusTextarea">Focus Textarea</label>
        <textarea id="focusTextarea" {...register('focusTextarea')} />
        <button type="button" onClick={() => setFocus('focusTextarea')}>
          Focus Textarea
        </button>
      </fieldset>
      <fieldset>
        <legend>Select textarea content on focus</legend>
        <label htmlFor="selectTextareaContent">Focus Textarea</label>
        <textarea
          id="selectTextareaContent"
          {...register('selectTextareaContent')}
        />
        <button
          type="button"
          onClick={() =>
            setFocus('selectTextareaContent', { shouldSelect: true })
          }
        >
          Select Textarea Content
        </button>
      </fieldset>
    </form>
  );
};

export default SetFocus;
