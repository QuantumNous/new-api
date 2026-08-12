import { Layout } from '@arco-design/web-react';
import { useLocation } from 'react-router-dom';
import { Header } from './header';
import { useContext, useEffect, useRef, useState } from 'react';
import { LanguageContext } from './i18n';
import { OptionDocument } from './option/index';
import { parseOutline } from './option/outline';
import { parseDescription } from './option/description';
import menu from '../menu.json';

export function Option() {
  const { language, setLanguage } = useContext(LanguageContext);

  const location = useLocation();
  const { pathname: pathName } = location;
  const assetDirectory = pathName.split('/')[2];

  const menuConfig = menu.find(menuItem => menuItem.menu === assetDirectory);

  const getOutline = async () => {
    try {
      const response = await fetch(`/documents/${assetDirectory}/${language}/outline.json`);
      const json = await response.json();
      return parseOutline(json, {}, [
        { from: 'Chart.axes$', to: 'Chart-axes' },
        { from: 'Chart.legends$', to: 'Chart-legends' },
        { from: 'Chart.extensionMark$', to: 'Chart-extensionMark' },
        { from: 'Chart.customMark$', to: 'Chart-customMark' },
        { from: 'Chart.series$', to: 'Chart-series' },
        { from: 'Chart.total$', to: 'Chart-total' }
      ]);
    } catch (e) {
      console.log(e);
    }
    return null;
  };
  const getDescription = async (pathName: string) => {
    try {
      const optionPath = pathName.split(`/${assetDirectory}/`)[1];
      if (!optionPath) {
        return [];
      }
      const basePath = optionPath.split('.')[0];
      const response = await fetch(
        !basePath || basePath === ''
          ? `/documents/${assetDirectory}/${language}/${assetDirectory}.json`
          : `/documents/${assetDirectory}/${language}/${assetDirectory}.${basePath}.json`
      );
      const json = await response.json();
      return parseDescription(json, basePath) ?? [];
    } catch (e) {
      console.log(e);
    }
    return '';
  };

  return (
    <Layout>
      <Layout.Header>
        <Header />
      </Layout.Header>
      <Layout style={{ height: 'calc(100vh - 48px)', marginTop: '48px' }}>
        <OptionDocument
          baseUrl={`/vchart/${assetDirectory}`}
          getOutline={getOutline}
          getDescription={getDescription}
          outlineStyle={{ maxHeight: 'calc(100vh - 48px)' }}
          descriptionStyle={{ maxHeight: 'calc(100vh - 48px)' }}
        />
      </Layout>
    </Layout>
  );
}
