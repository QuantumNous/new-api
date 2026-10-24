import { useTranslation } from 'react-i18next';

function Comp2() {
  const { t } = useTranslation(['ns1', 'ns2']);

  return (
    <div className="App">
      <p>{t('description.part1', { ns: 'ns1' })}</p>
      <p>{t('description.part2', { ns: 'ns2' })}</p>
    </div>
  );
}

export default Comp2;
