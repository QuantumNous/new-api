import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'ctx';
    contextSeparator: '|';
    resources: {
      ctx: {
        beverage: 'beverage';
        'beverage|beer': 'beer';

        'dessert|cake': 'a nice cake';
        'dessert|muffin_one': 'a nice muffin';
        'dessert|muffin_other': '{{count}} nice muffins';
      };
    };
  }
}
