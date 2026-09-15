import 'i18next';
import ns1 from './ns1.json';
import ns2 from './ns2.json';
import ns3 from './ns3.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'ns1';
    contextSeparator: '|';
    enableSelector: true;
    resources: {
      ns1: typeof ns1;
      ns2: typeof ns2;
      ns3: typeof ns3;
    };
  }
}
