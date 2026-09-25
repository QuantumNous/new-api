import React from 'react';
import { useTranslation, Trans } from 'react-i18next';

export default function CustomComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <Trans t={t}>
        description.part5 <strong>description.bold</strong>
      </Trans>
    </div>
  );
}
