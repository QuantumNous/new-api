import React from 'react';
import { useTranslation } from 'react-i18next';

export default function CustomComponent() {
  const { t } = useTranslation();

  return <div>{t('description.part2')}</div>;
}
