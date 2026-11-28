'use client';
import * as React from 'react';
import { Avatar } from '@base-ui/react/avatar';
import { Checkbox } from '@base-ui/react/checkbox';
import { Field } from '@base-ui/react/field';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import styles from './transition-attrs.module.css';

const AVATAR_SRC =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Malus_domestica_a1.jpg/500px-Malus_domestica_a1.jpg';

export default function TransitionAttrsExperiment() {
  return (
    <div className={styles.page}>
      <Section title="Field.Error">
        <FieldErrorDemo />
      </Section>

      <Section title="Field.Validity">
        <FieldValidityDemo />
      </Section>

      <Section title="Avatar.Image / Avatar.Fallback">
        <AvatarDemo />
      </Section>

      <Section title="Checkbox.Indicator">
        <CheckboxDemo />
      </Section>

      <Section title="Radio.Indicator">
        <RadioDemo />
      </Section>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{props.title}</h2>
      {props.children}
    </section>
  );
}

function FieldErrorDemo() {
  const [showError, setShowError] = React.useState(false);
  const [errorIndex, setErrorIndex] = React.useState(0);
  const actionsRef = React.useRef<Field.Root.Actions | null>(null);
  const showErrorRef = React.useRef(showError);
  const errorIndexRef = React.useRef(errorIndex);
  const errors = ['Please enter your name', 'Name must be at least 3 characters'];

  function commitState(nextShowError: boolean, nextErrorIndex: number) {
    showErrorRef.current = nextShowError;
    errorIndexRef.current = nextErrorIndex;
    setShowError(nextShowError);
    setErrorIndex(nextErrorIndex);
  }

  function runValidation() {
    actionsRef.current?.validate();
  }

  function handleToggleError() {
    const nextShowError = !showErrorRef.current;
    commitState(nextShowError, errorIndexRef.current);
    runValidation();
  }

  function handleNextError() {
    const nextIndex = (errorIndexRef.current + 1) % errors.length;
    commitState(true, nextIndex);
    runValidation();
  }

  function validateField() {
    return showErrorRef.current ? errors[errorIndexRef.current] : null;
  }

  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <button className={styles.button} onClick={handleToggleError} type="button">
          {showError ? 'Clear error' : 'Show error'}
        </button>
        <button className={styles.button} onClick={handleNextError} type="button">
          Next error
        </button>
      </div>
      <Field.Root
        actionsRef={actionsRef}
        validationMode="onChange"
        validate={validateField}
        className={styles.fieldRoot}
      >
        <Field.Label className={styles.label}>Name</Field.Label>
        <Field.Control required className={styles.input} placeholder="Required" />
        <Field.Description className={styles.description}>
          Visible on your profile
        </Field.Description>
        <div className={styles.errorSlot}>
          <Field.Error className={`${styles.error} ${styles.fade}`} match="customError" />
        </div>
      </Field.Root>
    </div>
  );
}

type TransitionDataAttributes = {
  'data-starting-style'?: '';
  'data-ending-style'?: '';
};

function getTransitionDataAttributes(transitionStatus: 'starting' | 'ending' | 'idle' | undefined) {
  if (transitionStatus === 'starting') {
    return { 'data-starting-style': '' } as TransitionDataAttributes;
  }
  if (transitionStatus === 'ending') {
    return { 'data-ending-style': '' } as TransitionDataAttributes;
  }
  return {} as TransitionDataAttributes;
}

function FieldValidityDemo() {
  const [showInvalid, setShowInvalid] = React.useState(false);
  const [renderIndicator, setRenderIndicator] = React.useState(false);
  const actionsRef = React.useRef<Field.Root.Actions | null>(null);
  const showInvalidRef = React.useRef(showInvalid);

  function commitShowInvalid(nextValue: boolean) {
    showInvalidRef.current = nextValue;
    setShowInvalid(nextValue);
  }

  function runValidation() {
    actionsRef.current?.validate();
  }

  function handleToggleValidity() {
    const nextShowInvalid = !showInvalidRef.current;
    if (nextShowInvalid) {
      setRenderIndicator(true);
    }
    commitShowInvalid(nextShowInvalid);
    runValidation();
  }

  function validateField() {
    return showInvalidRef.current ? 'invalid' : null;
  }

  function handleIndicatorTransitionEnd(event: React.TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (!showInvalidRef.current) {
      setRenderIndicator(false);
    }
  }

  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <button className={styles.button} onClick={handleToggleValidity} type="button">
          {showInvalid ? 'Set valid' : 'Set invalid'}
        </button>
      </div>
      <Field.Root
        actionsRef={actionsRef}
        validationMode="onChange"
        validate={validateField}
        className={styles.fieldRoot}
      >
        <Field.Label className={styles.label}>Status</Field.Label>
        <Field.Control className={styles.input} placeholder="Toggle validity" />
        <div className={styles.validitySlot}>
          <Field.Validity>
            {(state) => {
              if (!renderIndicator) {
                return null;
              }

              return (
                <div
                  className={`${styles.validityBadge} ${styles.fade}`}
                  onTransitionEnd={handleIndicatorTransitionEnd}
                  {...getTransitionDataAttributes(state.transitionStatus)}
                >
                  <span className={styles.validityIcon} aria-hidden />
                  Invalid
                </div>
              );
            }}
          </Field.Validity>
        </div>
      </Field.Root>
    </div>
  );
}

function AvatarDemo() {
  return (
    <div className={styles.stack}>
      <Avatar.Root className={styles.avatarRoot}>
        <Avatar.Image className={styles.avatarImage} src={AVATAR_SRC} />
        <Avatar.Fallback className={styles.avatarFallback}>AV</Avatar.Fallback>
      </Avatar.Root>
    </div>
  );
}

function CheckboxDemo() {
  const [checked, setChecked] = React.useState(false);

  function handleCheckedChange(next: boolean) {
    setChecked(next);
  }

  return (
    <label className={styles.option}>
      <Checkbox.Root
        checked={checked}
        onCheckedChange={handleCheckedChange}
        className={styles.checkboxBox}
      >
        <Checkbox.Indicator className={`${styles.checkboxIndicator} ${styles.indicatorFade}`} />
      </Checkbox.Root>
      Enable notifications
    </label>
  );
}

function RadioDemo() {
  return (
    <RadioGroup defaultValue="alpha" className={styles.radioGroup}>
      <label className={styles.option}>
        <Radio.Root value="alpha" className={styles.radioBox}>
          <Radio.Indicator className={`${styles.radioIndicator} ${styles.indicatorFade}`} />
        </Radio.Root>
        Alpha
      </label>
      <label className={styles.option}>
        <Radio.Root value="beta" className={styles.radioBox}>
          <Radio.Indicator className={`${styles.radioIndicator} ${styles.indicatorFade}`} />
        </Radio.Root>
        Beta
      </label>
    </RadioGroup>
  );
}
