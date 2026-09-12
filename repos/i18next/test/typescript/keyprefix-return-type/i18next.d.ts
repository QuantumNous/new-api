import 'i18next';

// #2434 regression scenario: two sibling keys both expose `title` with
// different shapes (string vs object). A `t` scoped to one sibling via
// `keyPrefix` must resolve `title` to only that sibling's value.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'app';
    resources: {
      app: {
        settings: {
          profile: {
            title: 'Profile';
            description: 'Manage your profile';
          };
          notifications: {
            title: {
              on: 'On';
              off: 'Off';
            };
          };
        };
      };
    };
  }
}
