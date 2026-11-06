import clsx from 'clsx';
import { Sidebar } from './_components/Sidebar';
import classes from './_components/ExperimentRoot.module.css';

export default async function Experiments() {
  return (
    <div className={clsx(classes.root, classes.withSidebar)}>
      <Sidebar className={classes.sidebar} />
      <main className={clsx(classes.main, classes.landing)}>
        <h1>Base UI experiments</h1>
        <p>← Choose an experiment from the list</p>
      </main>
    </div>
  );
}
