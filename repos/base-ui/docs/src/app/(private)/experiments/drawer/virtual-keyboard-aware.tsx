'use client';
import { Drawer } from '@base-ui/react/drawer';
import demoStyles from 'docs/src/app/(docs)/react/components/drawer/demos/virtual-keyboard-aware/css-modules/index.module.css';
import styles from './virtual-keyboard-aware.module.css';

interface DrawerField {
  label: string;
  placeholder: string;
  multiline?: boolean;
}

interface DrawerExample {
  title: string;
  description: string;
  trigger: string;
  drawerTitle: string;
  fields: DrawerField[];
  layout?: 'scrollable-popup';
}

const deliveryFields: DrawerField[] = [
  { label: 'Name', placeholder: 'Ada Lovelace' },
  { label: 'Phone', placeholder: '+1 (555) 123-4567' },
  { label: 'Street address', placeholder: '12 Computing Way' },
  { label: 'Apartment', placeholder: 'Unit 4B' },
  { label: 'City', placeholder: 'San Francisco' },
  { label: 'Postal code', placeholder: '94107' },
  { label: 'Delivery window', placeholder: 'After 6 PM' },
  { label: 'Backup contact', placeholder: 'Grace Hopper' },
];

const instructionsField: DrawerField = {
  label: 'Instructions',
  placeholder: 'Gate code, drop-off spot, or anything else the driver should know',
  multiline: true,
};

const examples: DrawerExample[] = [
  {
    title: 'Three fields',
    description: 'Short body content with the sticky footer composer still active.',
    trigger: 'Open three-field drawer',
    drawerTitle: 'Quick delivery',
    fields: deliveryFields.slice(0, 3),
  },
  {
    title: 'Input-only instructions',
    description: 'The public demo shape with the body textarea replaced by an input.',
    trigger: 'Open input-only drawer',
    drawerTitle: 'Delivery details',
    fields: [
      ...deliveryFields,
      {
        label: instructionsField.label,
        placeholder: instructionsField.placeholder,
      },
    ],
  },
  {
    title: 'Many fields',
    description: 'A longer form with extra body fields and multiple textareas.',
    trigger: 'Open long-form drawer',
    drawerTitle: 'Detailed delivery',
    fields: [
      ...deliveryFields,
      { label: 'Delivery date', placeholder: 'Friday, June 12' },
      instructionsField,
      {
        label: 'Accessibility notes',
        placeholder: 'Elevator access, stairs, concierge, or building-specific details',
        multiline: true,
      },
      {
        label: 'Substitution notes',
        placeholder: 'Preferred replacements, allergies, or items to skip',
        multiline: true,
      },
    ],
  },
  {
    title: 'Scrollable popup',
    description: 'A short plain drawer with eight fields and a single scroll container.',
    trigger: 'Open scrollable popup drawer',
    drawerTitle: 'Delivery note',
    layout: 'scrollable-popup',
    fields: deliveryFields,
  },
];

export default function DrawerVirtualKeyboardAwareExperiment() {
  return (
    <div className={styles.Root}>
      <div className={styles.Header}>
        <h1 className={styles.Title}>Drawer virtual keyboard aware</h1>
        <p className={styles.Description}>
          Compare keyboard-aware bottom sheets with different form lengths.
        </p>
      </div>

      <div className={styles.ExampleList}>
        {examples.map((example) => (
          <section className={styles.Example} key={example.title}>
            <div>
              <h2 className={styles.ExampleTitle}>{example.title}</h2>
              <p className={styles.ExampleDescription}>{example.description}</p>
            </div>
            <KeyboardAwareDrawer example={example} />
          </section>
        ))}
      </div>
    </div>
  );
}

function KeyboardAwareDrawer(props: { example: DrawerExample }) {
  const { example } = props;
  const isScrollablePopup = example.layout === 'scrollable-popup';

  return (
    <Drawer.Root>
      <Drawer.Trigger className={demoStyles.Button}>{example.trigger}</Drawer.Trigger>
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className={demoStyles.Backdrop} />
          <Drawer.Viewport
            className={
              isScrollablePopup
                ? `${demoStyles.Viewport} ${styles.ScrollablePopupViewport}`
                : demoStyles.Viewport
            }
          >
            {isScrollablePopup ? (
              <ScrollablePopupExample example={example} />
            ) : (
              <SplitFooterExample example={example} />
            )}
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}

function SplitFooterExample(props: { example: DrawerExample }) {
  const { example } = props;

  return (
    <Drawer.Popup className={demoStyles.Popup}>
      <div className={demoStyles.Header}>
        <div className={demoStyles.Handle} />
        <div className={demoStyles.HeaderActions}>
          <Drawer.Close className={`${demoStyles.Button} ${demoStyles.HeaderButton}`}>
            Cancel
          </Drawer.Close>
          <Drawer.Title className={demoStyles.Title}>{example.drawerTitle}</Drawer.Title>
          <Drawer.Close className={`${demoStyles.Button} ${demoStyles.HeaderButton}`}>
            Save
          </Drawer.Close>
        </div>
      </div>

      <Drawer.Content className={`${demoStyles.Scroll} ${styles.SplitFooterScroll}`}>
        <div className={demoStyles.Form}>
          {example.fields.map((field) => (
            <DrawerFieldControl field={field} key={field.label} />
          ))}
        </div>
      </Drawer.Content>

      <div className={demoStyles.FooterSlot}>
        <div className={demoStyles.StickyFooter}>
          <label className={demoStyles.Composer}>
            <span className={demoStyles.FieldLabel}>Delivery note</span>
            <input
              className={demoStyles.ComposerInput}
              placeholder="Add a note for the driver"
              type="text"
            />
          </label>
        </div>
      </div>
    </Drawer.Popup>
  );
}

function ScrollablePopupExample(props: { example: DrawerExample }) {
  const { example } = props;

  // A short, plain bottom sheet: no pinned header or footer, a single scroll
  // container (`Drawer.Content`) holding the title and every field. This mirrors
  // the scroll structure of the other bottom-sheet demos, so native touch
  // scrolling and keyboard slack target the same element.
  return (
    <Drawer.Popup className={`${demoStyles.Popup} ${styles.ScrollablePopup}`}>
      <Drawer.Content className={demoStyles.Scroll}>
        <div className={demoStyles.Form}>
          <Drawer.Title className={styles.ScrollablePopupTitle}>{example.drawerTitle}</Drawer.Title>
          {example.fields.map((field) => (
            <DrawerFieldControl field={field} key={field.label} />
          ))}
        </div>
      </Drawer.Content>
    </Drawer.Popup>
  );
}

function DrawerFieldControl(props: { field: DrawerField }) {
  const { field } = props;

  return (
    <label className={demoStyles.Field}>
      <span className={demoStyles.FieldLabel}>{field.label}</span>
      {field.multiline ? (
        <textarea className={demoStyles.Textarea} placeholder={field.placeholder} />
      ) : (
        <input className={demoStyles.Input} placeholder={field.placeholder} type="text" />
      )}
    </label>
  );
}
