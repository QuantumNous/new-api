import {Suspense, Component} from 'react';
import {Text, Button, View} from 'react-native';
import {useTranslation, withTranslation, Trans} from 'react-i18next';
import type {TFunction} from 'i18next';

// use hoc for class based components
class LegacyWelcomeClass extends Component<{t: TFunction}> {
  render() {
    const {t} = this.props;
    return <Text>{t('title')}</Text>;
  }
}
const Welcome = withTranslation()(LegacyWelcomeClass);

// Component using the Trans component
function MyComponent() {
  return (
    <Text>
      <Trans i18nKey="description.part1">
        To get started, edit <Text>src/App.js</Text> and save to reload.
      </Trans>
    </Text>
  );
}

function AppInner() {
  const {t, i18n} = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Welcome />

      <Button
        onPress={() => changeLanguage('en')}
        title="en"
        disabled={i18n.resolvedLanguage === 'en'}
      />
      <Button
        onPress={() => changeLanguage('de')}
        title="de"
        disabled={i18n.resolvedLanguage === 'de'}
      />

      <MyComponent />
      <Text>{t('description.part2')}</Text>
    </View>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Text>loading...</Text>}>
      <AppInner />
    </Suspense>
  );
}
