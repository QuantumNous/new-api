import * as React from 'react';
import * as styles from '../style.css';
import { TEST_DATA } from '../test.const';
const Button = (props: {
  children: any;
}) => {
  return <button>{props.children}</button>;
};
import { Route } from "inline.tsx";
import { test } from "inline.tsx";
const SplitComponent = () => {
  return <div className="p-2">
        {test}
        <h3 className={styles.indexPageTitle}>{TEST_DATA.welcome}</h3>
        <Button>Click me</Button>
      </div>;
};
export { SplitComponent as component };