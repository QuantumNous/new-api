import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'custom';
    resources: {
      custom: {
        greeting: 'Hello {{name}}!';
        count_message: 'You have {{count, number}} items';
        event_date: 'Event on {{date, datetime}}';
        price: 'Price: {{amount, currency}}';
        nested: 'Value is {{deep.val}}';
        no_interpolation: 'Just a plain string';
        mixed: '{{label}}: {{amount, number}} on {{when, datetime}}';
        price_eur: 'Price: {{price, currency(EUR)}}';
        event_relative: 'Happened {{when, relativetime(quarter)}}';
      };
    };
  }
}
