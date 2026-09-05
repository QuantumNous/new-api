'use client';
import * as Collapsible from './_components/Collapsible';
import styles from './collapsible.module.css';

const PARAGRAPH =
  'He rubbed his eyes, and came close to the picture, and examined it again. There were no signs of any change when he looked into the actual painting, and yet there was no doubt that the whole expression had altered. It was not a mere fancy of his own. The thing was horribly apparent.';

function StoryContent() {
  return (
    <Collapsible.Content>
      <p>{PARAGRAPH}</p>
    </Collapsible.Content>
  );
}

export default function PlainCollapsible() {
  return (
    <div className={styles.grid}>
      <div className={styles.wrapper}>
        <pre>keepMounted: true</pre>
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Trigger 1</Collapsible.Trigger>
          <Collapsible.Panel keepMounted>
            <StoryContent />
          </Collapsible.Panel>
        </Collapsible.Root>

        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Trigger>Trigger 2</Collapsible.Trigger>
          <Collapsible.Panel keepMounted>
            <StoryContent />
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>
      </div>

      <div className={styles.wrapper}>
        <pre>keepMounted: false</pre>
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Trigger 3</Collapsible.Trigger>
          <Collapsible.Panel keepMounted={false}>
            <StoryContent />
          </Collapsible.Panel>
        </Collapsible.Root>

        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Trigger>Trigger 4</Collapsible.Trigger>
          <Collapsible.Panel keepMounted={false}>
            <StoryContent />
          </Collapsible.Panel>
        </Collapsible.Root>
        <small>———</small>
      </div>
    </div>
  );
}
