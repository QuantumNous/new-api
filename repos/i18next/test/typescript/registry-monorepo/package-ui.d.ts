import 'i18next';

// shared UI package — own namespace only
declare module 'i18next' {
  interface ResourceNamespaceMap {
    '@repo/ui': {
      button_label: 'Click';
      panel: {
        title: 'Settings';
      };
    };
  }
}
