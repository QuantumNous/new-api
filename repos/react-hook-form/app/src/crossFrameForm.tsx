import React from 'react';
import ReactDOM from 'react-dom/client';
import { useForm } from 'react-hook-form';
import App from './app';

const FRAME_CONTENT = `
  <style>
    label {display: block; margin-bottom: .5em}
    form {margin-bottom: 2em}
    input {margin: 0 1em}
  </style>

  <div id='inner-root'>
    Loading content...
  </div>
`;

const FRAME_STYLE = {
  width: '640px',
  height: '480px',
  background: 'white',
};

const CrossFrameForm: React.FC = () => {
  const ref = React.useRef<HTMLIFrameElement>(null);

  function renderFormInFrame() {
    const rootElement =
      ref.current!.contentDocument!.getElementById('inner-root');
    const root = ReactDOM.createRoot(rootElement);
    root.render(<FrameForm />);
  }

  return (
    <iframe
      ref={ref}
      style={FRAME_STYLE}
      srcDoc={FRAME_CONTENT}
      onLoad={renderFormInFrame}
    />
  );
};

const FrameForm: React.FC = () => {
  const { register, watch } = useForm();

  const value = watch();

  return (
    <>
      <form>
        <label>
          Free text
          <input type="text" {...register('input', { required: true })} />
        </label>

        <label>
          <input
            type="radio"
            value="a"
            {...register('radio', { required: true })}
          />
          Choice A
        </label>

        <label>
          <input
            type="radio"
            value="b"
            {...register('radio', { required: true })}
          />
          Choice B
        </label>
      </form>

      <label>
        Form value
        <pre>{JSON.stringify(value)}</pre>
      </label>
    </>
  );
};

export default CrossFrameForm;
