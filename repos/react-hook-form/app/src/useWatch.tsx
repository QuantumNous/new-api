import React from 'react';
import { useForm, Control, useWatch, Controller } from 'react-hook-form';
import { useRef } from 'react';

type FormInputs = {
  test: string;
  test1: string;
  test2: string;
};

let counter = 0;

const GrandChild = ({
  control,
  index = 0,
}: {
  control: Control<FormInputs>;
  index?: number;
}) => {
  const counter1 = useRef(0);
  const output = useWatch({
    name: 'test',
    control,
  });

  counter1.current++;

  return (
    <div style={{ border: '2px solid blue', padding: 10, margin: 5 }}>
      <h2 style={{ margin: 0 }}>Grandchild 0:</h2>
      <p id={`grandchild0${index}`}>{output}</p>
      <p id="grandChildCounter">Render counter: {counter1.current}</p>
    </div>
  );
};

const GrandChild1 = ({ control }: { control: Control<FormInputs> }) => {
  const counter = useRef(0);
  const output = useWatch<FormInputs>({
    name: ['test', 'test1'],
    control,
  });

  counter.current++;

  return (
    <div style={{ border: '2px solid blue', padding: 10, margin: 5 }}>
      <h2 style={{ margin: 0 }}>Grandchild 1:</h2>
      <p id="grandchild1">
        {output[0]}
        {output[1]}
      </p>
      <p id="grandChild1Counter">Render counter: {counter.current}</p>
    </div>
  );
};

const GrandChild2 = ({
  control,
}: {
  control: Control<{
    test: string;
    test1: string;
    test2: string;
  }>;
}) => {
  const counter = useRef(0);
  const output = useWatch<{
    test: string;
    test1: string;
    test2: string;
  }>({
    control,
  });

  counter.current++;

  return (
    <div style={{ border: '2px solid blue', padding: 10, margin: 5 }}>
      <h2 style={{ margin: 0 }}>Grandchild 2:</h2>
      <p id="grandchild2">
        {output.test}
        {output.test1}
        {output.test2}
      </p>
      <p id="grandChild2Counter">Render counter: {counter.current}</p>
    </div>
  );
};

const Child = ({ control }: { control: Control<FormInputs> }) => {
  const counter1 = useRef(0);
  counter1.current++;

  return (
    <div style={{ border: '2px solid green', padding: 10, margin: 5 }}>
      <h2 style={{ margin: 0 }}>Child:</h2>
      <GrandChild index={1} control={control} />
      <p id="childCounter" style={{ color: 'red' }}>
        <b>Render counter: {counter1.current} 👀</b>
      </p>
    </div>
  );
};

export default () => {
  const { register, control } = useForm<FormInputs>();

  counter++;

  return (
    <div style={{ border: '2px solid red', padding: 10, margin: 5 }}>
      <h2 style={{ margin: 0 }}>Parent:</h2>
      <input
        {...register('test')}
        autoComplete="off"
        placeholder="👀 watching me :)"
        style={{ fontSize: 20 }}
      />

      <Controller
        name="test1"
        control={control}
        render={({ field }) => (
          <input
            placeholder="👀 watching me :)"
            autoComplete="off"
            style={{ fontSize: 20 }}
            {...field}
          />
        )}
        defaultValue=""
      />

      <input
        {...register('test2')}
        name="test2"
        autoComplete="off"
        placeholder="👀 watching me :)"
        style={{ fontSize: 20 }}
      />

      <GrandChild control={control} />
      <Child control={control} />
      <GrandChild1 control={control} />
      <GrandChild2 control={control} />

      <p id="parentCounter" style={{ color: 'red' }}>
        <b>Render counter: {counter} 👀</b>
      </p>
    </div>
  );
};
