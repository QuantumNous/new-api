import 'i18next';

declare const ns1: {
  beverage: 'beverage';
  coffee: {
    drip: {
      black: 'a strong cup of black coffee';
    };
  };
};

declare const ns2: {
  fromNs2: 'hello from ns2';
  nested: {
    deep: 'deeply nested in ns2';
  };
};

declare const ns3: {
  fromNs3: 'hello from ns3';
};

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'ns1';
    enableSelector: 'strict';
    resources: {
      ns1: typeof ns1;
      ns2: typeof ns2;
      ns3: typeof ns3;
    };
  }
}
