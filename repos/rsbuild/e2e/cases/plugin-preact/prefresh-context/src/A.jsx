import { createContext } from 'preact';
import { useContext, useState } from 'preact/hooks';
import B from './test-temp-B';

const MyContext = createContext();

export const MyProvider = ({ children }) => {
  const [value, setValue] = useState(0);
  return <MyContext.Provider value={{ value, setValue }}>{children}</MyContext.Provider>;
};

const App = () => {
  const { value, setValue } = useContext(MyContext);
  return (
    <>
      <button id="A" type="button" onClick={() => setValue(value + 1)}>
        A: {value}
      </button>
      <B count={value} />
    </>
  );
};

export default () => {
  return (
    <MyProvider>
      <App />
    </MyProvider>
  );
};
