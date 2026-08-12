import React from 'react';
import { useForm } from 'react-hook-form';

const Watch: React.FC = () => {
  const { register, handleSubmit, watch } = useForm<{
    testSingle: string;
    test: string[];
    testObject: {
      firstName: string;
      lastName: string;
    };
    toggle: string;
  }>();
  const onSubmit = () => {};
  const test = watch('test');
  const testObject = watch('testObject');
  const testSingle = watch('testSingle');
  const testArray = watch(['test.0', 'test.1']);
  const toggle = watch('toggle');
  const watchAll = watch();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('testSingle')} placeholder="testSingle" />
      {testSingle === 'testSingle' && (
        <div id="HideTestSingle">Hide Content TestSingle</div>
      )}

      <input {...register('test.0')} placeholder="test[0]" />
      <input {...register('test.1')} placeholder="test[1]" />

      <div id="testData">{JSON.stringify(test)}</div>
      <div id="testArray">{JSON.stringify(testArray)}</div>

      <input
        {...register('testObject.firstName')}
        placeholder="testObject.firstName"
      />
      <input
        {...register('testObject.lastName')}
        placeholder="testObject.lastName"
      />

      <div id="testObject">{JSON.stringify(testObject)}</div>

      <input type="checkbox" {...register('toggle')} />
      {toggle && <div id="hideContent">Hide Content</div>}

      <div id="watchAll">{JSON.stringify(watchAll)}</div>

      <button>Submit</button>
    </form>
  );
};

export default Watch;
