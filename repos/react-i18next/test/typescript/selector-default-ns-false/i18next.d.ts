import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: false;
    enableSelector: true;
    resources: {
      ns1: {
        prova: 'prova 1';
        job_details: {
          title: 'sample test';
        };
      };
    };
  }
}
