import React from 'react';
import { withTranslation } from 'react-i18next';

export function CustomComponent({ t }) {
  return <div>{t('description.part3')}</div>;
}

export default withTranslation()(CustomComponent);
