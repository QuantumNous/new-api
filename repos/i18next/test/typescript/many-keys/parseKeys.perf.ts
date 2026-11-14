import { t, ParseKeys } from 'i18next';

const getKey: () => ParseKeys<['generic']> = () => 'ahTLUS';
const result = t(getKey());

console.info(result);
