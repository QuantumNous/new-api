import React from 'react';
import { useForm } from 'react-hook-form';

function WatchDefaultValues() {
  const { watch } = useForm({
    defaultValues: {
      test: 'test',
      test1: {
        firstName: 'firstName',
        lastName: ['lastName0', 'lastName1'],
        deep: {
          nest: 'nest',
        },
      },
      'flatName[1]': {
        whatever: 'flat',
      },
    },
  });

  const all = watch();
  const array = watch(['test', 'flatName[1]']);
  const singleObject = watch('test1.firstName');
  const arrayStringOrObject = watch(['test', 'test1.firstName']);
  const getDeepArray = watch('test1.lastName');
  const singleDeepArray = watch('test1.lastName.0');

  return (
    <>
      <div id="watchAll">{JSON.stringify(all)}</div>
      <br />
      <div id="array">{JSON.stringify(array)}</div>
      <br />
      <div id="getArray">{JSON.stringify(getDeepArray)}</div>
      <br />
      <div id="object">{JSON.stringify(arrayStringOrObject)}</div>
      <br />
      <div id="single">{JSON.stringify(singleObject)}</div>
      <br />
      <div id="singleDeepArray">{JSON.stringify(singleDeepArray)}</div>
    </>
  );
}

export default WatchDefaultValues;
