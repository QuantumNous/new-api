import { describe, it, expect } from 'vitest';
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { useTranslation } from '../src/useTranslation';
import { I18nextProvider } from '../src/I18nextProvider';

describe('useTranslation with bindI18nStore', () => {
  it('should correctly return the correct translation', async () => {
    const i18next = createInstance();
    await i18next.init({
      fallbackLng: ['en'],
      react: { bindI18nStore: 'added' },
    });
    function TranslateAKey() {
      const { t } = useTranslation();
      return <h1>{t('key', { ns: 'namespace' })}</h1>;
    }
    i18next.addResourceBundle('en', 'namespace', { key: 'english' }, false, true);
    render(
      <I18nextProvider i18n={i18next}>
        <TranslateAKey />
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('english');
    await act(() => i18next.changeLanguage('de'));
    expect(screen.getByRole('heading')).toHaveTextContent('english');
    await act(() => i18next.addResourceBundle('de', 'namespace', { key: 'deutsch' }, false, true));
    expect(screen.getByRole('heading')).toHaveTextContent('deutsch'); // this assertion fails
  });
});
