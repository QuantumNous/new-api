import { I18nextProvider, useTranslation } from 'react-i18next';
import i18next from './i18n';

export const i18n = i18next;

function Comp() {
  const { t } = useTranslation();

  return <div>{t('hello')}</div>;
}

export function MyCompFromOtherLib() {
  return (
    <I18nextProvider i18n={i18n}>
      <Comp />
    </I18nextProvider>
  );
}
