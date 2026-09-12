/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React, {Suspense} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  Button,
} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';

import i18next from 'i18next';
import {initReactI18next, useTranslation} from 'react-i18next';

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: (cb) => cb('en'),
  init: () => {},
  cacheUserLanguage: () => {},
};

i18next
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: true,
    resources: {
      en: {
        translation: {
          hello: 'Hello world',
          change: 'Change language',
        },
      },
      de: {
        translation: {
          hello: 'Hallo welt',
          change: 'Sprache wechseln',
        },
      },
    },
  });

// page uses the hook
function Content() {
  const {t, i18n} = useTranslation();

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scrollView}>
          <View style={styles.body}>
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{t('hello')}</Text>
              <Button
                onPress={() =>
                  i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de')
                }
                title={t('change')}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

// loading component for suspense fallback
const Loader = () => (
  <View style={styles.body}>
    <Text style={styles.sectionTitle}>loading...</Text>
  </View>
);

const App: () => React$Node = () => {
  return (
    <Suspense fallback={<Loader />}>
      <Content />
    </Suspense>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.lighter,
  },
  engine: {
    position: 'absolute',
    right: 0,
  },
  body: {
    backgroundColor: Colors.white,
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.black,
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.dark,
  },
  highlight: {
    fontWeight: '700',
  },
  footer: {
    color: Colors.dark,
    fontSize: 12,
    fontWeight: '600',
    padding: 4,
    paddingRight: 12,
    textAlign: 'right',
  },
});

export default App;
