import i18next from 'i18next';
import './i18n/config.js';

console.log(i18next.t('ns1:title'));
console.log(i18next.t('title'));
console.log(i18next.t('ns1:description.part1'));
console.log(i18next.t('ns1:description.part2'));
console.log(i18next.t('ns2:description.part2'));
console.log(i18next.t('description.part2', { ns: 'ns2' }));

console.log(i18next.t('some'));
console.log(i18next.t('some', { context: 'me' }));
console.log(i18next.t('some', { context: '1234' }));

console.log(i18next.t('pl', { count: 1 }));
console.log(i18next.t('pl', { count: 2 }));

// interpolation
i18next.t('inter', { val: 'xx' });

// interpolation and unescaped
i18next.t('interUnescaped', { val: 'xx' });

// this ts error occurs only if resources are imported:
//   1) as const (ts file)
//   or
//   2) as interface (d.ts file)
// throws only with ts v5
// // @ts-expect-error
// i18next.t('inter', { valWrong: 'xx' });

const tNs2 = i18next.getFixedT('en', 'ns2');
console.log(tNs2('description.part2'));

const fk = i18next.t('some.fallback');
console.log(fk);
