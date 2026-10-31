import i18next from 'i18next';
import './i18n/config.js';

console.log(i18next.t(($) => $.title, { ns: 'ns1' }));
console.log(i18next.t(($) => $.title));
console.log(i18next.t(($) => $.description.part1, { ns: 'ns1' }));
console.log(i18next.t(($) => $.description.part2, { ns: 'ns1' }));
console.log(i18next.t(($) => $.description.part2, { ns: 'ns2' }));

console.log(i18next.t(($) => $.some));
console.log(i18next.t(($) => $.some, { context: 'me' }));
console.log(i18next.t(($) => $.some, { context: '1234' }));

console.log(i18next.t(($) => $.pl, { count: 1 }));
console.log(i18next.t(($) => $.pl, { count: 2 }));

// interpolation
i18next.t(($) => $.inter, { val: 'xx' });

// interpolation and unescaped
i18next.t(($) => $.interUnescaped, { val: 'xx' });

const tNs2 = i18next.getFixedT('en', 'ns2');
console.log(tNs2(($) => $.description.part2));
