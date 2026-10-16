import { t, ParseKeys } from 'i18next';

const getKey: () => ParseKeys<['generic']> = () => 'ahTLUS';
const result = t(getKey());
const result2 = t(getKey(), 'default value');
const result3 = t(getKey(), { defaultValue: 'default value' });

console.info(result);

console.info(result2);

console.info(result3);
