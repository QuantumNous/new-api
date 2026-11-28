import i18n from 'i18next';

// set instance on hooks stuff
import { setI18n } from '../src/context';

setI18n(i18n);

i18n.init({
  lng: 'en',
  fallbackLng: 'en',

  resources: {
    en: {
      translation: {
        key1: 'test',
        interpolateKeyWithDefaultVariables: 'add {{defaultInsert}} {{defaultUp, uppercase}}',
        interpolateKey: 'add {{insert}} {{up, uppercase}}',
        interpolateKey2: '<strong>add</strong> {{insert}} {{up, uppercase}}',
        myKey:
          'This is a <CustomLink href="https://example.com/">link to example.com</CustomLink>.',
        transTest1: 'Go <1>there</1>.',
        transTest1_noParent: '<0>Go <1>there</1>.</0>',
        transTest1_customHtml: '<strong>Go</strong> <br/><1>there</1>.',
        transTest1_customHtml2: '<strong>Go</strong> <br/> there.',
        transTest1_customHtml3:
          '<strong>Go</strong><video /><script>console.warn("test")</script> there.',
        transTest2:
          'Hello <1><0>{{name}}</0></1>, you have <3>{{count}}</3> message. Open <5>hear</5>.',
        transTest2_other:
          'Hello <1><0>{{name}}</0></1>, you have <3>{{count}}</3> messages. Open <5>here</5>.',
        transTest2InV2: 'Hello <1>{{name}}</1>, you have {{count}} message. Open <5>hear</5>.',
        transTest2InV2_other:
          'Hello <1>{{name}}</1>, you have {{count}} messages. Open <5>here</5>.',
        testTransKey1: '<0>{{numOfItems}}</0> item matched.',
        testTransKey1_other: '<0>{{numOfItems}}</0> items matched.',
        testTransKey2: '<0><0>{{numOfItems}}</0></0> item matched.',
        testTransKey2_other: '<0><0>{{numOfItems}}</0></0> items matched.',
        testTransKey3: 'Result: <1><0>{{numOfItems}}</0></1> item matched.',
        testTransKey3_other: 'Result: <1><0>{{numOfItems}}</0></1> items matched.',
        testInvalidHtml: '<hello',
        testInvalidHtml2: '<hello>',
        testTrans4KeyWithNestedComponent: 'Result should be a list: <0></0>',
        testTrans5KeyWithNestedComponent: 'Result should be a list: <1></1>',
        testTrans5KeyWithValue: 'Result should be rendered within tag <0>{{testValue}}</0>',
        transTest3: 'Result should be a clickable link <0 href="https://www.google.com">Google</0>',
        transTest3_overwrite:
          'Result should be a clickable link <0 href="https://www.bing.com">Google</0>',
        transTestEscapedHtml: 'Escaped html should unescape correctly <0>&lt;&nbsp;&amp;&gt;</0>.',
        transTestCustomUnescape: 'Text should be passed through custom unescape <0>&shy;</0>',
        transTestCustomUnescapeSecond: 'Vertrauens&shy;kennwert',
        'trans-key-with-generic-var': 'Value as is: {{foo}}',
        'trans-key-with-number-var': 'Treat value as number: {{foo, number}}',
        testTransWithCtx: 'Go <1>there</1>.',
        testTransWithCtx_home: 'Go <1>home</1>.',
        testTransNoChildrenWithCtx: 'Go {{context}}.',
        testTransNoChildrenWithCtx_home: 'Go to Switzerland.',
        'You have {{count}} message_one': 'You have {{count}} message',
        'You have {{count}} message_other': 'You have {{count}} messages',
        deepPath: {
          deepKey1: 'value1',
        },
        transTestWithSelfClosing: 'interpolated component: <component/>',
        bracketNotation: '{{count}}',
        otherNotation: '#$?count?$#',
        issue1893: 'Hello <Item title="{{ name }}" />!',
      },
      other: {
        transTest1: 'Another go <1>there</1>.',
        nestingKey1: 'This is key1 value and $t(nestedKey2)',
        nestedKey2: 'This is key2 value',
        nestingInterKey3: 'should work {{check_this}}',
      },
    },
  },

  interpolation: {
    escapeValue: false, // not needed for react!!
    formatSeparator: ',',
    defaultVariables: {
      defaultInsert: 'first',
      defaultUp: 'second',
      check_this: '$t(nestedKey2)',
    },
  },

  react: {
    defaultTransParent: 'div',
    transSupportBasicHtmlNodes: true,
    transKeepBasicHtmlNodesFor: ['br', 'strong', 'i'],
  },
});

i18n.services.formatter.add('uppercase', (value) => value.toUpperCase());

export default i18n;
