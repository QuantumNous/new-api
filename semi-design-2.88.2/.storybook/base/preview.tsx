// import 'reset-css';
// import 'normalize.css';
import React from 'react';
import { StoryContext } from '@storybook/react';

import { ConfigProvider } from '@douyinfe/semi-ui/index';
import { ContextValue } from '@douyinfe/semi-ui/configProvider/context'
import zh_CN from '@douyinfe/semi-ui/locale/source/zh_CN';
import en_GB from '@douyinfe/semi-ui/locale/source/en_GB';
import ko_KR from '@douyinfe/semi-ui/locale/source/ko_KR';
import ja_JP from '@douyinfe/semi-ui/locale/source/ja_JP';
import ar from '@douyinfe/semi-ui/locale/source/ar';
import vi_VN from '@douyinfe/semi-ui/locale/source/vi_VN';
import ru_RU from '@douyinfe/semi-ui/locale/source/ru_RU';
import id_ID from '@douyinfe/semi-ui/locale/source/id_ID';
import ms_MY from '@douyinfe/semi-ui/locale/source/ms_MY';
import th_TH from '@douyinfe/semi-ui/locale/source/th_TH';
import tr_TR from '@douyinfe/semi-ui/locale/source/tr_TR';
import pt_BR from '@douyinfe/semi-ui/locale/source/pt_BR';
import zh_TW from '@douyinfe/semi-ui/locale/source/zh_TW';
import es from '@douyinfe/semi-ui/locale/source/es';
import de from '@douyinfe/semi-ui/locale/source/de';
import it from '@douyinfe/semi-ui/locale/source/it';
import fr from '@douyinfe/semi-ui/locale/source/fr';
import ro from '@douyinfe/semi-ui/locale/source/ro';

export const globalTypes = {
    direction: {
        name: 'Direction',
        description: 'RTL direction',
        defaultValue: 'ltr',
        toolbar: {
            icon: 'globe',
            items: ['ltr', 'rtl'],
        },
    },
    theme: {
        name: 'Theme',
        description: 'Theme mode',
        defaultValue: 'light',
        toolbar: {
            icon: 'circle',
            items: ['light', 'dark'],
        },
    },
    language: {
      name: 'Locale',
      description: 'Locale language',
      defaultValue: 'zh_CN',
      toolbar: {
          icon: 'google',
          items: ['zh_CN', 'en_GB', 'ko_KR', 'ja_JP', 'ar', 'vi_VN', 'ru_RU', 'id_ID', 'ms_MY', 'th_TH', 'tr_TR', 'pt_BR', 'zh_TW', 'es', 'de', 'it', 'fr', 'ro'],
      },
    }
};

const switchMode = (theme: 'light' | 'dark') => {
    const body = document.body;
    body.setAttribute('theme-mode', theme);
};

const getLocale = code => {
  let language = {
      zh_CN,
      en_GB,
      ko_KR,
      ja_JP,
      ar,
      vi_VN,
      ru_RU,
      id_ID,
      ms_MY,
      th_TH,
      tr_TR,
      pt_BR,
      zh_TW,
      es,
      de,
      it,
      fr,
      ro
  };

  return language[code];
};

const withConfigProvider = (StoryFn: Function, context: StoryContext) => {
    const { direction, theme, language } = context.globals;
    const { componentId } = context;
    switchMode(theme);
    const locale = getLocale(language);
    let configProps: ContextValue = {
        direction,
        locale
    };

    if (['localeprovider'].includes(componentId)) {
        configProps.locale = null;
    }

    return (
        <ConfigProvider {...configProps}>
            <StoryFn />
        </ConfigProvider>
    );
};

export const decorators = [withConfigProvider];
