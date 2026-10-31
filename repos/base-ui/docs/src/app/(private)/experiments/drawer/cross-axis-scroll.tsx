import { Drawer } from '@base-ui/react/drawer';
import clsx from 'clsx';
import heroStyles from 'docs/src/app/(docs)/react/components/drawer/demos/hero/css-modules/index.module.css';
import positionStyles from 'docs/src/app/(docs)/react/components/drawer/demos/position/css-modules/index.module.css';
import styles from './cross-axis-scroll.module.css';

type SwipeDirection = 'left' | 'right' | 'up' | 'down';
type OverflowAxis = 'x' | 'y';

interface DrawerCase {
  id: string;
  label: string;
  swipeDirection: SwipeDirection;
  overflowAxis: OverflowAxis;
}

const drawerCases: DrawerCase[] = [
  {
    id: 'right-x',
    label: 'Right drawer - X overflow',
    swipeDirection: 'right',
    overflowAxis: 'x',
  },
  {
    id: 'right-y',
    label: 'Right drawer - Y overflow',
    swipeDirection: 'right',
    overflowAxis: 'y',
  },
  {
    id: 'left-x',
    label: 'Left drawer - X overflow',
    swipeDirection: 'left',
    overflowAxis: 'x',
  },
  {
    id: 'left-y',
    label: 'Left drawer - Y overflow',
    swipeDirection: 'left',
    overflowAxis: 'y',
  },
  {
    id: 'down-y',
    label: 'Down drawer - Y overflow',
    swipeDirection: 'down',
    overflowAxis: 'y',
  },
  {
    id: 'down-x',
    label: 'Down drawer - X overflow',
    swipeDirection: 'down',
    overflowAxis: 'x',
  },
  {
    id: 'up-y',
    label: 'Up drawer - Y overflow',
    swipeDirection: 'up',
    overflowAxis: 'y',
  },
  {
    id: 'up-x',
    label: 'Up drawer - X overflow',
    swipeDirection: 'up',
    overflowAxis: 'x',
  },
];

export default function DrawerCrossAxisScrollExperiment() {
  return (
    <div className={styles.Root}>
      <h1 className={styles.Title}>Drawer cross-axis scroll matrix</h1>
      <p className={styles.Description}>
        Open each case and test swipe-dismiss on the drawer axis and native scrolling on the
        overflow axis.
      </p>

      <div className={styles.Grid}>
        {drawerCases.map((testCase) => (
          <DrawerCaseCard key={testCase.id} testCase={testCase} />
        ))}
      </div>
    </div>
  );
}

function DrawerCaseCard(props: { testCase: DrawerCase }) {
  const { testCase } = props;
  const sideDrawer = testCase.swipeDirection === 'left' || testCase.swipeDirection === 'right';
  const verticalDrawer = !sideDrawer;

  return (
    <section className={styles.Card}>
      <h2 className={styles.CardTitle}>{testCase.label}</h2>
      <p className={styles.CardDescription}>
        Swipe direction: <strong>{testCase.swipeDirection}</strong>. Scroll overflow axis:{' '}
        <strong>{testCase.overflowAxis.toUpperCase()}</strong>.
      </p>

      <Drawer.Root swipeDirection={testCase.swipeDirection}>
        <Drawer.Trigger className={heroStyles.Button}>Open case</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Backdrop className={heroStyles.Backdrop} />
          <Drawer.Viewport
            className={clsx(
              sideDrawer ? heroStyles.Viewport : positionStyles.Viewport,
              testCase.swipeDirection === 'left' && styles.ViewportLeft,
              testCase.swipeDirection === 'up' && styles.ViewportUp,
            )}
          >
            <Drawer.Popup
              className={clsx(
                sideDrawer ? heroStyles.Popup : positionStyles.Popup,
                testCase.swipeDirection === 'left' && styles.PopupLeft,
                testCase.swipeDirection === 'up' && styles.PopupUp,
                verticalDrawer && styles.PopupVerticalContent,
              )}
            >
              <Drawer.Content className={heroStyles.Content}>
                <Drawer.Title className={heroStyles.Title}>{testCase.label}</Drawer.Title>
                <Drawer.Description className={heroStyles.Description}>
                  Try scrolling in the panel first, then swipe to dismiss from the drawer edge.
                </Drawer.Description>
                <OverflowRegion axis={testCase.overflowAxis} />
                <div className={heroStyles.Actions}>
                  <Drawer.Close className={heroStyles.Button}>Close</Drawer.Close>
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </section>
  );
}

function OverflowRegion(props: { axis: OverflowAxis }) {
  const { axis } = props;

  if (axis === 'y') {
    return (
      <div className={styles.ScrollRegionY}>
        {Array.from({ length: 16 }, (_, index) => (
          <div key={`row-${index}`} className={styles.Row}>
            Vertical row {index + 1}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.ScrollRegionX}>
      <div className={styles.Track}>
        {Array.from({ length: 12 }, (_, index) => (
          <div key={`chip-${index}`} className={styles.Chip}>
            Horizontal item {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
