import 'i18next';

// overlap ns — registry side; legacy keys are in package-app-legacy.d.ts
declare module 'i18next' {
  interface ResourceNamespaceMap {
    overlap: {
      registry_only: 'from registry';
      shared_literal: 'same value';
      shared_conflict: 'B';
    };
  }
}
