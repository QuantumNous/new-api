import React from 'react';
import { Translation } from 'react-i18next';

export default function CustomComponent() {
  return <Translation>{(t) => <div>{t('description.part4')}</div>}</Translation>;
}
