import { Tabs } from '@base-ui/react/tabs';
import styles from './index.module.css';

export default function ExampleTabs() {
  return (
    <Tabs.Root className={styles.Root} defaultValue="overview">
      <Tabs.List className={styles.List}>
        <Tabs.Tab className={styles.Tab} value="overview">
          Overview
        </Tabs.Tab>
        <Tabs.Tab className={styles.Tab} value="projects">
          Projects
        </Tabs.Tab>
        <Tabs.Tab className={styles.Tab} value="account">
          Account
        </Tabs.Tab>
        <Tabs.Indicator className={styles.Indicator} />
      </Tabs.List>
      <div className={styles.PanelViewport}>
        <Tabs.Panel className={styles.Panel} value="overview">
          <p className={styles.Paragraph}>Workspace stats and activity.</p>
        </Tabs.Panel>
        <Tabs.Panel className={styles.Panel} value="projects">
          <p className={styles.Paragraph}>Milestones and deadlines.</p>
        </Tabs.Panel>
        <Tabs.Panel className={styles.Panel} value="account">
          <p className={styles.Paragraph}>Profile and preferences.</p>
        </Tabs.Panel>
      </div>
    </Tabs.Root>
  );
}
