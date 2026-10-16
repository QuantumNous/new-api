import React, { Component, Suspense } from 'react';
import { useTranslation, withTranslation, Trans } from 'react-i18next';

class ClassComponent extends Component {
  render() {
    const { t } = this.props;
    return <h2>{t('title')}</h2>;
  }
}

const ComponentUsingHOC = withTranslation()(ClassComponent);

function ComponentUsingHook() {
  const { t } = useTranslation();
  return <div>{t('description.part2')}</div>;
}

function ComponentUsingTrans() {
  return (
    <Trans i18nKey="description.part1">
      To get started, edit <code>src/App.js</code> and save to reload.
    </Trans>
  );
}

export default {
  title: 'Components',
};
export const Mocking = () => <ClassComponent t={(k) => k} />;
Mocking.storyName = 'Mocking t()';

export const UsingHOC = () => <ComponentUsingHOC />;
export const UsingHook = () => <ComponentUsingHook />;
export const UsingTransComponent = () => <ComponentUsingTrans />;
