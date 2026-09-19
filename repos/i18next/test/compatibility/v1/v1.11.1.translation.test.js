import { describe, it, expect, vitest, beforeEach } from 'vitest';
import {
  i18nCompatibilityV1 as i18n,
  getI18nCompatibilityV1InitOptions,
  httpApiCompatibilityV1 as httpApi,
  httpApiReadMockImplementation,
} from './v1.i18nInstance.js';
import * as compat from './v1.js';

describe('v1.11.1 translation', () => {
  let opts;

  beforeEach(() => {
    opts = compat.convertAPIOptions(getI18nCompatibilityV1InitOptions());
  });

  describe('keys with non supported values', () => {
    const resStore = {
      dev: { translation: {} },
      en: { translation: {} },
      'en-US': {
        translation: {
          test: 'hi',
        },
      },
    };

    beforeEach(async () => {
      await i18n.init(i18n.functions.extend(opts, { resStore }));
    });

    it('it should not break on null key', () => {
      expect(i18n.t(null)).to.equal('');
    });

    it('it should not break on undefined key', () => {
      expect(i18n.t(undefined)).to.equal('');
    });

    it('it should stringify first on number key', () => {
      expect(i18n.t(1)).to.equal(i18n.t('1'));
      expect(i18n.t(1.1)).to.equal(i18n.t('1.1'));
    });
  });

  describe('resource is missing', () => {
    const resStore = {
      dev: { translation: {} },
      en: { translation: {} },
      'en-US': { translation: {} },
    };

    beforeEach(async () => {
      await i18n.init(i18n.functions.extend(opts, { resStore }));
    });

    it('it should return key', () => {
      expect(i18n.t('missing')).to.equal('translation:missing');
    });

    it('it should return default value if set', () => {
      expect(i18n.t('missing', { defaultValue: 'defaultOfMissing' })).to.equal('defaultOfMissing');
    });

    describe('with namespaces', () => {
      it('it should return key', () => {
        expect(i18n.t('translate:missing')).to.equal('translate:missing');
      });

      it('it should return default value if set', () => {
        expect(i18n.t('translate:missing', { defaultValue: 'defaultOfMissing' })).to.equal(
          'defaultOfMissing',
        );
      });

      describe('and function parseMissingKey set', () => {
        beforeEach(async () => {
          await i18n.init(
            i18n.functions.extend(opts, {
              parseMissingKey(key) {
                let ret = key;

                if (ret.indexOf(':')) {
                  ret = ret.substring(ret.lastIndexOf(':') + 1, ret.length);
                }

                if (ret.indexOf('.')) {
                  ret = ret.substring(ret.lastIndexOf('.') + 1, ret.length);
                }

                return ret;
              },
            }),
          );
        });

        it('it should parse key', () => {
          expect(i18n.t('translate:missing')).to.equal('missing');
          expect(i18n.t('translate:somenesting.missing')).to.equal('missing');
        });

        it('it should return default value if set', () => {
          expect(i18n.t('translate:missing', { defaultValue: 'defaultOfMissing' })).to.equal(
            'defaultOfMissing',
          );
        });
      });
    });
  });

  describe('Check for existence of keys', () => {
    const resStore = {
      dev: { translation: { iExist: '' } },
      en: { translation: {} },
      'en-US': { translation: {} },
    };

    beforeEach(async () => {
      i18n.init(i18n.functions.extend(opts, { resStore }));
    });

    it('it should exist', () => {
      expect(i18n.exists('iExist')).to.equal(true);
    });

    it('it should not exist', () => {
      expect(i18n.exists('iDontExist')).to.equal(false);
    });

    describe('missing on unspecific', () => {
      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore, lng: 'en' }));
      });

      it('it should exist', () => {
        expect(i18n.exists('iExist')).to.equal(true);
      });

      it('it should not exist', () => {
        expect(i18n.exists('iDontExist')).to.equal(false);
      });
    });
  });

  describe('resource string is null', () => {
    const resStore = {
      dev: { translation: { key1: null, key2: { key3: null } } },
      en: { translation: {} },
      'en-US': { translation: {} },
    };

    beforeEach(async () => {
      await i18n.init(
        i18n.functions.extend(opts, {
          resStore,
          returnObjectTrees: true,
          fallbackOnNull: false,
        }),
      );
    });

    it('it should translate value', () => {
      expect(i18n.t('key1')).to.equal(null);
      expect(i18n.t('key2')).to.eql({ key3: null });
    });
  });

  describe('with option fallbackOnNull = true', () => {
    const resStore = {
      dev: { translation: { key1: 'fallbackKey1', key2: { key3: 'fallbackKey3' } } },
      en: { translation: {} },
      'en-US': { translation: { key1: null, key2: { key3: null } } },
    };

    beforeEach(async () => {
      await i18n.init(i18n.functions.extend(opts, { resStore, fallbackOnNull: true }));
    });

    it('it should translate to fallback value', () => {
      expect(i18n.t('key1')).to.equal('fallbackKey1');
      expect(i18n.t('key2.key3')).to.eql('fallbackKey3');
    });
  });

  describe('key with empty string value as valid option', () => {
    describe('it should translate correctly with default language', () => {
      const resStore = {
        dev: { translation: { empty: '' } },
        en: { translation: {} },
        'en-US': { translation: {} },
      };
      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it('it should translate correctly', () => {
        expect(i18n.t('empty')).to.equal('');
      });
    });

    describe('missing on unspecific', () => {
      const resStore = {
        dev: { translation: { empty: 'text' } },
        en: { translation: {} },
        'en-US': { translation: { empty: '' } },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore, lng: 'en' }));
      });

      it('it should translate correctly', () => {
        expect(i18n.t('empty')).to.equal('text');
      });
    });

    describe('on specific language', () => {
      const resStore = {
        dev: { translation: { empty: 'text' } },
        en: { translation: {} },
        'en-US': { translation: { empty: '' } },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it('it should translate correctly', () => {
        expect(i18n.t('empty')).to.equal('');
      });
    });
  });

  describe('key with empty string set to fallback if empty', () => {
    describe('missing on unspecific', () => {
      const resStore = {
        dev: { translation: { empty: '' } },
        en: { translation: {} },
        'en-US': { translation: {} },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore, fallbackOnEmpty: true }));
      });

      it('it should translate correctly', () => {
        expect(i18n.t('empty')).to.equal('translation:empty');
      });
    });

    describe('missing on unspecific', () => {
      const resStore = {
        dev: { translation: { empty: 'text' } },
        en: { translation: {} },
        'en-US': { translation: { empty: '' } },
      };

      beforeEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, { resStore, lng: 'en', fallbackOnEmpty: true }),
        );
      });

      it('it should translate correctly', () => {
        expect(i18n.t('empty')).to.equal('text');
      });
    });

    describe('on specific language', () => {
      const resStore = {
        dev: { translation: { empty: 'text' } },
        en: { translation: {} },
        'en-US': { translation: { empty: '' } },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore, fallbackOnEmpty: true }));
      });

      it('it should translate correctly', () => {
        expect(i18n.t('empty')).to.equal('text');
      });
    });
  });

  describe('resource key as array', () => {
    const resStore = {
      dev: { translation: { existing1: 'hello _name_', existing2: 'howdy __name__' } },
      en: { translation: {} },
      'en-US': { translation: {} },
    };

    beforeEach(async () => {
      await i18n.init(i18n.functions.extend(opts, { resStore }));
    });

    describe('when none of the keys exist', () => {
      it('return the same value as translating the last non-existent key', () => {
        expect(i18n.t(['nonexistent1', 'nonexistent2'], { name: 'Joe' })).to.equal(
          i18n.t('nonexistent2', { name: 'Joe' }),
        );
      });
    });

    describe('when one of the keys exist', () => {
      it('return the same value as translating the one existing key', () => {
        expect(i18n.t(['nonexistent1', 'existing2'], { name: 'Joe' })).to.equal(
          i18n.t('existing2', { name: 'Joe' }),
        );
      });
    });

    describe('when two or more of the keys exist', () => {
      it('return the same value as translating the first existing key', () => {
        expect(i18n.t(['nonexistent1', 'existing2', 'existing1'], { name: 'Joe' })).to.equal(
          i18n.t('existing2', { name: 'Joe' }),
        );
      });
    });
  });

  describe('resource string as array', () => {
    const resStore = {
      dev: { translation: { testarray: ['title', 'text'] } },
      en: { translation: {} },
      'en-US': { translation: {} },
    };

    beforeEach(async () => {
      await i18n.init(i18n.functions.extend(opts, { resStore }));
    });

    it('it should translate nested value', () => {
      expect(i18n.t('testarray')).to.equal('title\ntext');
    });
  });

  describe('accessing tree values', () => {
    describe('basic usage', () => {
      const resStore = {
        dev: { translation: {} },
        en: { translation: {} },
        'en-US': {
          translation: {
            test: { 'simple_en-US': 'ok_from_en-US' },
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it('it should return nested string as usual', () => {
        expect(i18n.t('test.simple_en-US')).to.equal('ok_from_en-US');
      });

      it('it should not fail silently on accessing an objectTree', () => {
        expect(i18n.t('test')).to.equal("key 'test (en-US)' returned an object instead of string.");
      });
    });

    describe('optional return an objectTree for UI components,...', () => {
      describe('with init flag', () => {
        const resStore = {
          dev: {
            translation: {
              test_dev: { res_dev: 'added __replace__' },
            },
          },
          en: { translation: {} },
          'en-US': {
            translation: {
              test_en_US: { res_en_US: 'added __replace__' },
            },
          },
        };

        beforeEach(async () => {
          await i18n.init(
            i18n.functions.extend(opts, {
              returnObjectTrees: true,
              resStore,
            }),
          );
        });

        it('it should return objectTree applying options', () => {
          expect(i18n.t('test_en_US', { replace: 'two' })).to.eql({ res_en_US: 'added two' });
          expect(i18n.t('test_en_US', { replace: 'three' })).to.eql({ res_en_US: 'added three' });
          expect(i18n.t('test_en_US', { replace: 'four' })).to.eql({ res_en_US: 'added four' });

          // from fallback
          expect(i18n.t('test_dev', { replace: 'two' })).to.eql({ res_dev: 'added two' });
        });
      });

      describe('with flag in options', () => {
        const resStore = {
          dev: { translation: {} },
          en: { translation: {} },
          'en-US': {
            translation: {
              test: {
                res: 'added __replace__',
                id: 0,
                regex: /test/,
                func() {},
                template: '4',
                title: 'About...',
                text: 'Site description',
                media: ['test'],
              },
            },
          },
        };

        beforeEach(async () => {
          await i18n.init(i18n.functions.extend(opts, { returnObjectTrees: false, resStore }));
        });

        it('it should return objectTree', () => {
          expect(i18n.t('test', { returnObjectTrees: true, replace: 'two' })).to.eql({
            res: 'added two',
            id: 0,
            regex: resStore['en-US'].translation.test.regex,
            func: resStore['en-US'].translation.test.func,
            template: '4',
            title: 'About...',
            text: 'Site description',
            media: ['test'],
          });
          // expect(i18n.t('test', { returnObjectTrees: true, replace: 'three' })).to.eql({ 'res': 'added three' });
          // expect(i18n.t('test', { returnObjectTrees: true, replace: 'four' })).to.eql({ 'res': 'added four' });
        });
      });
    });
  });

  describe('resource nesting', () => {
    describe('basic usage', () => {
      const resStore = {
        dev: { translation: { nesting1: '1 $t(nesting2)' } },
        en: { translation: { nesting2: '2 $t(nesting3)' } },
        'en-US': { translation: { nesting3: '3' } },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it('it should translate nested value', () => {
        expect(i18n.t('nesting1')).to.equal('1 2 3');
      });

      it('it should apply nested value on defaultValue', () => {
        expect(i18n.t('nesting_default', { defaultValue: '0 $t(nesting1)' })).to.equal('0 1 2 3');
      });
    });

    describe('resource nesting syntax error', () => {
      const resStore = {
        dev: { translation: { nesting1: '1 $t(nesting2' } },
        en: { translation: { nesting2: '2 $t(nesting3)' } },
        'en-US': { translation: { nesting3: '3' } },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it.skip('[WONT FIX - FIX YOUR APPLICATION]it should translate nested value', () => {
        expect(i18n.t('nesting1')).to.equal('');
      });
    });

    describe('with setting new options', () => {
      const resStore = {
        dev: {
          translation: {
            nesting1: '$t(nesting2, {"count": __girls__}) and __count__ boy',
            nesting1_plural: '$t(nesting2, {"count": __girls__}) and __count__ boys',
          },
        },
        en: {
          translation: {
            nesting2: '__count__ girl',
            nesting2_plural: '__count__ girls',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it('it should translate nested value and set new options', () => {
        expect(i18n.t('nesting1', { count: 2, girls: 3 })).to.equal('3 girls and 2 boys');
        expect(i18n.t('nesting1', { count: 1, girls: 3 })).to.equal('3 girls and 1 boy');
      });
    });
  });

  describe('resource nesting with multiple namespaces and fallbackNS', () => {
    const resStore = {
      dev: { translation1: { nesting1: '1 $t(nesting2)' } },
      en: { translation: { nesting2: '2 $t(nesting3)' } },
      'en-US': { translation: { nesting3: '3' } },
    };

    beforeEach(async () => {
      await i18n.init(
        i18n.functions.extend(opts, {
          resStore,
          ns: { namespaces: ['translation1', 'translation'], defaultNs: 'translation1' },
          fallbackNS: ['translation'],
        }),
      );
    });

    it('it should translate nested value', () => {
      expect(i18n.t('translation1:nesting1')).to.equal('1 2 3');
    });
  });

  describe('interpolation - replacing values inside a string', () => {
    describe('default i18next way', () => {
      const resStore = {
        dev: { translation: {} },
        en: { translation: {} },
        'en-US': {
          translation: {
            interpolationTest1: 'added __toAdd__',
            interpolationTest2: 'added __toAdd__ __toAdd__ twice',
            interpolationTest3: 'added __child.one__ __child.two__',
            interpolationTest4: 'added __child.grandChild.three__',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it('it should replace passed in key/values', () => {
        expect(i18n.t('interpolationTest1', { toAdd: 'something' })).to.equal('added something');
        expect(i18n.t('interpolationTest1', { toAdd: null })).to.equal('added ');
        // expect(i18n.t('interpolationTest1', {})).to.equal('added '); // does not work anymore since removal of compatibilityAPI === v1
        expect(i18n.t('interpolationTest2', { toAdd: 'something' })).to.equal(
          'added something something twice',
        );
        expect(i18n.t('interpolationTest3', { child: { one: '1', two: '2' } })).to.equal(
          'added 1 2',
        );
        expect(i18n.t('interpolationTest4', { child: { grandChild: { three: '3' } } })).to.equal(
          'added 3',
        );
      });

      it('it should replace passed in key/values in replace member', () => {
        expect(i18n.t('interpolationTest1', { replace: { toAdd: 'something' } })).to.equal(
          'added something',
        );
        expect(i18n.t('interpolationTest2', { replace: { toAdd: 'something' } })).to.equal(
          'added something something twice',
        );
        expect(
          i18n.t('interpolationTest3', { replace: { child: { one: '1', two: '2' } } }),
        ).to.equal('added 1 2');
        expect(
          i18n.t('interpolationTest4', { replace: { child: { grandChild: { three: '3' } } } }),
        ).to.equal('added 3');
      });

      it('it should not escape HTML', () => {
        expect(i18n.t('interpolationTest1', { toAdd: '<html>' })).to.equal('added <html>');
      });

      it('it should replace passed in key/values on defaultValue', () => {
        expect(
          i18n.t('interpolationTest5', { defaultValue: 'added __toAdd__', toAdd: 'something' }),
        ).to.equal('added something');
      });

      it('it should escape dollar signs in replacement values', () => {
        expect(i18n.t('interpolationTest1', { toAdd: '$&' })).to.equal('added $&');
      });
    });

    describe('default i18next way - different prefix/suffix', () => {
      const resStore = {
        dev: { translation: {} },
        en: { translation: {} },
        'en-US': {
          translation: {
            interpolationTest1: 'added *toAdd*',
            interpolationTest2: 'added *toAdd* *toAdd* twice',
            interpolationTest3: 'added *child.one* *child.two*',
            interpolationTest4: 'added *child.grandChild.three*',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            resStore,
            interpolationPrefix: '*',
            interpolationSuffix: '*',
          }),
        );
      });

      it('it should replace passed in key/values', () => {
        expect(i18n.t('interpolationTest1', { toAdd: 'something' })).to.equal('added something');
        expect(i18n.t('interpolationTest2', { toAdd: 'something' })).to.equal(
          'added something something twice',
        );
        expect(i18n.t('interpolationTest3', { child: { one: '1', two: '2' } })).to.equal(
          'added 1 2',
        );
        expect(i18n.t('interpolationTest4', { child: { grandChild: { three: '3' } } })).to.equal(
          'added 3',
        );
      });

      it('it should replace passed in key/values on defaultValue', () => {
        expect(
          i18n.t('interpolationTest5', { defaultValue: 'added *toAdd*', toAdd: 'something' }),
        ).to.equal('added something');
      });
    });

    describe('default i18next way - different prefix/suffix via options', () => {
      const resStore = {
        dev: { translation: {} },
        en: { translation: {} },
        'en-US': {
          translation: {
            interpolationTest1: 'added *toAdd*',
            interpolationTest2: 'added *toAdd* *toAdd* twice',
            interpolationTest3: 'added *child.one* *child.two*',
            interpolationTest4: 'added *child.grandChild.three*',
            interpolationTest5: 'added *count*',
            interpolationTest5_plural: 'added *count*',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            resStore,
          }),
        );
      });

      it('it should replace passed in key/values', () => {
        expect(
          i18n.t('interpolationTest1', {
            toAdd: 'something',
            interpolationPrefix: '*',
            interpolationSuffix: '*',
          }),
        ).to.equal('added something');
        expect(
          i18n.t('interpolationTest2', {
            toAdd: 'something',
            interpolationPrefix: '*',
            interpolationSuffix: '*',
          }),
        ).to.equal('added something something twice');
        expect(
          i18n.t('interpolationTest3', {
            child: { one: '1', two: '2' },
            interpolationPrefix: '*',
            interpolationSuffix: '*',
          }),
        ).to.equal('added 1 2');
        expect(
          i18n.t('interpolationTest4', {
            child: { grandChild: { three: '3' } },
            interpolationPrefix: '*',
            interpolationSuffix: '*',
          }),
        ).to.equal('added 3');
        expect(
          i18n.t('interpolationTest5', {
            count: 3,
            interpolationPrefix: '*',
            interpolationSuffix: '*',
          }),
        ).to.equal('added 3');
      });

      it('it should replace passed in key/values on defaultValue', () => {
        expect(
          i18n.t('interpolationTest6', {
            defaultValue: 'added *toAdd*',
            toAdd: 'something',
            interpolationPrefix: '*',
            interpolationSuffix: '*',
          }),
        ).to.equal('added something');
      });
    });

    describe('default i18next way - with escaping interpolated arguments per default', () => {
      const resStore = {
        dev: { translation: {} },
        en: { translation: {} },
        'en-US': {
          translation: {
            interpolationTest1: 'added __toAdd__',
            interpolationTest5: 'added __toAddHTML__',
            interpolationTest6: 'added __child.oneHTML__',
            interpolationTest7: 'added __toAddHTML__ __toAdd__',
            interpolationTest8: 'added __toAdd1__ __toAdd2__',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore, escapeInterpolation: true }));
      });

      it('it should escape HTML', () => {
        expect(i18n.t('interpolationTest1', { toAdd: '<html>' })).to.equal('added &lt;html&gt;');
      });

      it('it should not escape when HTML is suffixed', () => {
        expect(i18n.t('interpolationTest5', { toAdd: '<html>' })).to.equal('added <html>');
        expect(i18n.t('interpolationTest6', { child: { one: '<1>' } })).to.equal('added <1>');
      });

      it('it should support both escaping and not escaping HTML', () => {
        expect(
          i18n.t('interpolationTest7', { toAdd: '<html>', escapeInterpolation: true }),
        ).to.equal('added <html> &lt;html&gt;');
      });

      // it('should not accept interpolations from inside interpolations', () => { // does not work anymore since removal of compatibilityAPI === v1
      //   expect(
      //     i18n.t('interpolationTest8', { toAdd1: '__toAdd2HTML__', toAdd2: '<html>' }),
      //   ).to.equal('added  &lt;html&gt;');
      // });

      it('it should escape dollar signs in replacement values', () => {
        expect(i18n.t('interpolationTest1', { toAdd: '$&' })).to.equal('added $&amp;');
      });
    });

    describe('default i18next way - with escaping interpolated arguments per default via options', () => {
      const resStore = {
        dev: { translation: {} },
        en: { translation: {} },
        'en-US': {
          translation: {
            interpolationTest1: 'added __toAdd__',
            interpolationTest5: 'added __toAddHTML__',
            interpolationTest6: 'added __child.oneHTML__',
            interpolationTest7: 'added __toAddHTML__ __toAdd__',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it('it should escape HTML', () => {
        expect(
          i18n.t('interpolationTest1', { toAdd: '<html>', escapeInterpolation: true }),
        ).to.equal('added &lt;html&gt;');
      });

      it('it should not escape when HTML is suffixed', () => {
        expect(
          i18n.t('interpolationTest5', { toAdd: '<html>', escapeInterpolation: true }),
        ).to.equal('added <html>');
        expect(
          i18n.t('interpolationTest6', { child: { one: '<1>', escapeInterpolation: true } }),
        ).to.equal('added <1>');
      });

      it('it should support both escaping and not escaping HTML', () => {
        expect(
          i18n.t('interpolationTest7', { toAdd: '<html>', escapeInterpolation: true }),
        ).to.equal('added <html> &lt;html&gt;');
      });

      it('it should escape dollar signs in replacement values', () => {
        expect(i18n.t('interpolationTest1', { toAdd: '$&', escapeInterpolation: true })).to.equal(
          'added $&amp;',
        );
      });
    });

    describe('using sprintf', () => {
      const resStore = {
        dev: { translation: {} },
        en: { translation: {} },
        'en-US': {
          translation: {
            interpolationTest1:
              'The first 4 letters of the english alphabet are: %s, %s, %s and %s',
            interpolationTest2: 'Hello %(users[0].name)s, %(users[1].name)s and %(users[2].name)s',
            interpolationTest3: 'The last letter of the english alphabet is %s',
            interpolationTest4: 'Water freezes at %d degrees',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it('it should replace passed in key/values', () => {
        expect(
          i18n.t('interpolationTest1', { postProcess: 'sprintf', sprintf: ['a', 'b', 'c', 'd'] }),
        ).to.equal('The first 4 letters of the english alphabet are: a, b, c and d');
        expect(
          i18n.t('interpolationTest2', {
            postProcess: 'sprintf',
            sprintf: { users: [{ name: 'Dolly' }, { name: 'Molly' }, { name: 'Polly' }] },
          }),
        ).to.equal('Hello Dolly, Molly and Polly');
      });

      it('it should recognize the sprintf syntax and automatically add the sprintf processor', () => {
        expect(i18n.t('interpolationTest1', 'a', 'b', 'c', 'd')).to.equal(
          'The first 4 letters of the english alphabet are: a, b, c and d',
        );
        expect(i18n.t('interpolationTest3', 'z')).to.equal(
          'The last letter of the english alphabet is z',
        );
        expect(i18n.t('interpolationTest4', 0)).to.equal('Water freezes at 0 degrees');
      });
    });

    describe('with default variables', () => {
      const defaultVariables = {
        name: 'John',
      };

      /** @type {import('vitest').MockInstance}  */
      let spy;

      beforeEach(async () => {
        spy = vitest.spyOn(httpApi, 'read').mockImplementation(httpApiReadMockImplementation);
        await i18n.init(i18n.functions.extend(opts, { defaultVariables }));
        return () => {
          spy.mockReset();
        };
      });

      it('it should use default variable', () => {
        expect(i18n.t('Hello __name__')).to.equal('Hello John');
      });

      it('it should replace default variable', () => {
        expect(i18n.t('Hello __name__', { name: 'Ben' })).to.equal('Hello Ben');
      });
    });
  });

  describe('plural usage', () => {
    describe('basic usage - singular and plural form', () => {
      const resStore = {
        dev: {
          'ns.2': {
            pluralTest: 'singular from ns.2',
            pluralTest_plural: 'plural from ns.2',
            pluralTestWithCount: '__count__ item from ns.2',
            pluralTestWithCount_plural: '__count__ items from ns.2',
          },
        },
        en: {},
        'en-US': {
          'ns.1': {
            pluralTest: 'singular',
            pluralTest_plural: 'plural',
            pluralTestWithCount: '__count__ item',
            pluralTestWithCount_plural: '__count__ items',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            resStore,
            ns: { namespaces: ['ns.1', 'ns.2'], defaultNs: 'ns.1' },
          }),
        );
      });

      it('it should provide correct plural or singular form', () => {
        expect(i18n.t('pluralTest', { count: 0 })).to.equal('plural');
        expect(i18n.t('pluralTest', { count: 1 })).to.equal('singular');
        expect(i18n.t('pluralTest', { count: 2 })).to.equal('plural');
        expect(i18n.t('pluralTest', { count: 7 })).to.equal('plural');
      });

      it('it should provide correct plural or singular form with interpolation', () => {
        expect(i18n.t('pluralTestWithCount', { count: 0 })).to.equal('0 items');
        expect(i18n.t('pluralTestWithCount', { count: 1 })).to.equal('1 item');
        expect(i18n.t('pluralTestWithCount', { count: 7 })).to.equal('7 items');
      });

      it('it should provide correct plural or singular form for second namespace', () => {
        expect(i18n.t('ns.2:pluralTest', { count: 0 })).to.equal('plural from ns.2');
        expect(i18n.t('ns.2:pluralTest', { count: 1 })).to.equal('singular from ns.2');
        expect(i18n.t('ns.2:pluralTest', { count: 2 })).to.equal('plural from ns.2');
        expect(i18n.t('ns.2:pluralTest', { count: 7 })).to.equal('plural from ns.2');
      });

      it('it should provide correct plural or singular form for second namespace with interpolation', () => {
        expect(i18n.t('ns.2:pluralTestWithCount', { count: 1 })).to.equal('1 item from ns.2');
        expect(i18n.t('ns.2:pluralTestWithCount', { count: 7 })).to.equal('7 items from ns.2');
      });
    });

    describe('fallback on count with non-plurals', () => {
      const resStore = {
        dev: {
          'ns.2': {
            pluralTestWithCount: '__count__ item from ns.2',
          },
        },
        en: {},
        'en-US': {
          'ns.1': {
            pluralTestWithCount: '__count__ item',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            resStore,
            ns: { namespaces: ['ns.1', 'ns.2'], defaultNs: 'ns.1' },
          }),
        );
      });

      it('it should provide correct singular form', () => {
        expect(i18n.t('pluralTestWithCount', { count: 0 })).to.equal('0 item');
        expect(i18n.t('pluralTestWithCount', { count: 1 })).to.equal('1 item');
        expect(i18n.t('pluralTestWithCount', { count: 7 })).to.equal('7 item');
      });

      it('it should provide correct singular form for second namespace', () => {
        expect(i18n.t('ns.2:pluralTestWithCount', { count: 1 })).to.equal('1 item from ns.2');
        expect(i18n.t('ns.2:pluralTestWithCount', { count: 7 })).to.equal('7 item from ns.2');
      });
    });

    describe('Plurals with passing lng to translation function', () => {
      const resStore = {
        nl: {
          translation: {
            pluralTest: 'item',
            pluralTest_plural: 'items',
            pluralTestWithCount: '__count__ item',
            pluralTestWithCount_plural: '__count__ items',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it('should return the correct string for key', () => {
        expect(i18n.t('pluralTest', { count: 12, lng: 'nl' })).to.equal('items');
        expect(i18n.t('pluralTest', { count: 0, lng: 'nl' })).to.equal('items');
      });

      it('should return the correct string for key with count interpoation', () => {
        expect(i18n.t('pluralTestWithCount', { count: 12, lng: 'nl' })).to.equal('12 items');
        expect(i18n.t('pluralTestWithCount', { count: 0, lng: 'nl' })).to.equal('0 items');
      });
    });

    describe('basic usage - singular and plural form on fallbacks', () => {
      const resStore = {
        fr: {
          translation: {},
        },
        en: {
          translation: {
            pluralTest: 'singular',
            pluralTest_plural: 'plural',
            pluralTestWithCount: '__count__ item',
            pluralTestWithCount_plural: '__count__ items',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            resStore,
            lng: 'fr',
            fallbackLng: 'en',
          }),
        );
      });

      it('it should provide correct plural or singular form', () => {
        expect(i18n.t('pluralTest', { count: 0 })).to.equal('plural');
        expect(i18n.t('pluralTest', { count: 1 })).to.equal('singular');
        expect(i18n.t('pluralTest', { count: 2 })).to.equal('plural');
        expect(i18n.t('pluralTest', { count: 7 })).to.equal('plural');
      });

      it('it should provide correct plural or singular form with count', () => {
        expect(i18n.t('pluralTestWithCount', { count: 0 })).to.equal('0 items');
        expect(i18n.t('pluralTestWithCount', { count: 1 })).to.equal('1 item');
        expect(i18n.t('pluralTestWithCount', { count: 7 })).to.equal('7 items');
      });
    });

    describe('basic usage 2 - singular and plural form in french', () => {
      const resStore = {
        dev: {
          'ns.2': {
            pluralTest: 'singular from ns.2',
            pluralTest_plural: 'plural from ns.2',
            pluralTestWithCount: '__count__ item from ns.2',
            pluralTestWithCount_plural: '__count__ items from ns.2',
          },
        },
        en: {},
        fr: {
          'ns.1': {
            pluralTest: 'singular',
            pluralTest_plural: 'plural',
            pluralTestWithCount: '__count__ item',
            pluralTestWithCount_plural: '__count__ items',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            lng: 'fr',
            resStore,
            ns: { namespaces: ['ns.1', 'ns.2'], defaultNs: 'ns.1' },
          }),
        );
      });

      it('it should provide correct plural or singular form', () => {
        expect(i18n.t('pluralTest', { count: 0 })).to.equal('singular');
        expect(i18n.t('pluralTest', { count: 1 })).to.equal('singular');
        expect(i18n.t('pluralTest', { count: 2 })).to.equal('plural');
        expect(i18n.t('pluralTest', { count: 7 })).to.equal('plural');
      });

      it('it should provide correct plural or singular form with count', () => {
        expect(i18n.t('pluralTestWithCount', { count: 0 })).to.equal('0 item');
        expect(i18n.t('pluralTestWithCount', { count: 1 })).to.equal('1 item');
        expect(i18n.t('pluralTestWithCount', { count: 7 })).to.equal('7 items');
      });
    });

    describe('extended usage - multiple plural forms - ar', () => {
      const resStore = {
        dev: { translation: {} },
        ar: {
          translation: {
            key: 'singular',
            key_plural_0: 'zero',
            key_plural_2: 'two',
            key_plural_3: 'few',
            key_plural_11: 'many',
            key_plural_100: 'plural',
          },
        },
        'ar-??': { translation: {} },
      };

      beforeEach(async () => {
        i18n.init(i18n.functions.extend(opts, { lng: 'ar', resStore }));
      });

      it('it should provide correct plural forms', () => {
        expect(i18n.t('key', { count: 0 })).to.equal('zero');
        expect(i18n.t('key', { count: 1 })).to.equal('singular');
        expect(i18n.t('key', { count: 2 })).to.equal('two');
        expect(i18n.t('key', { count: 3 })).to.equal('few');
        expect(i18n.t('key', { count: 4 })).to.equal('few');
        expect(i18n.t('key', { count: 104 })).to.equal('few');
        expect(i18n.t('key', { count: 11 })).to.equal('many');
        expect(i18n.t('key', { count: 99 })).to.equal('many');
        expect(i18n.t('key', { count: 199 })).to.equal('many');
        expect(i18n.t('key', { count: 100 })).to.equal('plural');
      });
    });

    describe('extended usage - multiple plural forms - ru', () => {
      const resStore = {
        dev: { translation: {} },
        ru: {
          translation: {
            key: '1,21,31',
            key_plural_2: '2,3,4',
            key_plural_5: '0,5,6',
          },
        },
        'ru-??': { translation: {} },
      };

      beforeEach(async () => {
        i18n.init(i18n.functions.extend(opts, { lng: 'ru', resStore }));
      });

      it('it should provide correct plural forms', () => {
        expect(i18n.t('key', { count: 0 })).to.equal('0,5,6');
        expect(i18n.t('key', { count: 1 })).to.equal('1,21,31');
        expect(i18n.t('key', { count: 2 })).to.equal('2,3,4');
        expect(i18n.t('key', { count: 3 })).to.equal('2,3,4');
        expect(i18n.t('key', { count: 4 })).to.equal('2,3,4');
        expect(i18n.t('key', { count: 104 })).to.equal('2,3,4');
        expect(i18n.t('key', { count: 11 })).to.equal('0,5,6');
        expect(i18n.t('key', { count: 24 })).to.equal('2,3,4');
        expect(i18n.t('key', { count: 25 })).to.equal('0,5,6');
        expect(i18n.t('key', { count: 99 })).to.equal('0,5,6');
        expect(i18n.t('key', { count: 199 })).to.equal('0,5,6');
        expect(i18n.t('key', { count: 100 })).to.equal('0,5,6');
      });
    });

    describe('extended usage - ask for a key in a language with a different plural form', () => {
      const resStore = {
        en: {
          translation: {
            key: 'singular_en',
            key_plural: 'plural_en',
          },
        },
        zh: {
          translation: {
            key: 'singular_zh',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { lng: 'zh', resStore }));
      });

      it('it should provide translation for passed in language with 1 item', () => {
        expect(i18n.t('key', { lng: 'en', count: 1 })).to.equal('singular_en');
      });

      it('it should provide translation for passed in language with 2 items', () => {
        expect(i18n.t('key', { lng: 'en', count: 2 })).to.equal('plural_en');
      });
    });
  });

  describe.skip('[WONT FIX - FIND A BETTER SOLUTION]indefinite article usage', () => {
    describe('basic usage - singular, plural and indefinite', () => {
      const resStore = {
        dev: {
          'ns.2': {
            thing: '__count__ thing from ns.2',
            thing_plural: '__count__ things from ns.2',
            thing_indefinite: 'A thing from ns.2',
            thing_plural_indefinite: 'Some things from ns.2',
          },
          'ns.3': {
            thing: '__count__ things',
            thing_indefinite: 'A thing',
            thing_plural_indefinite: 'Some things',
          },
        },
        en: {},
        'en-US': {
          'ns.1': {
            thing: '__count__ thing',
            thing_plural: '__count__ things',
            thing_indefinite: 'A thing',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            resStore,
            ns: { namespaces: ['ns.1', 'ns.2', 'ns.3'], defaultNs: 'ns.1' },
          }),
        );
      });

      it('it should provide the indefinite article when requested for singular forms', () => {
        expect(i18n.t('thing')).to.equal('__count__ thing');
        expect(i18n.t('thing', { indefinite_article: true })).to.equal('A thing');
        expect(i18n.t('thing', { count: 1 })).to.equal('1 thing');
        expect(i18n.t('thing', { count: 5 })).to.equal('5 things');
        expect(i18n.t('thing', { count: 1, indefinite_article: true })).to.equal('A thing');
        expect(i18n.t('thing', { count: 5, indefinite_article: true })).to.equal('5 things');
      });

      it('it should provide the indefinite article when requested for singular forms for second namespace', () => {
        expect(i18n.t('ns.2:thing', { count: 1 })).to.equal('1 thing from ns.2');
        expect(i18n.t('ns.2:thing', { count: 5 })).to.equal('5 things from ns.2');
        expect(i18n.t('ns.2:thing', { count: 1, indefinite_article: true })).to.equal(
          'A thing from ns.2',
        );
        expect(i18n.t('ns.2:thing', { count: 5, indefinite_article: true })).to.equal(
          'Some things from ns.2',
        );
      });

      it('it should provide the right indefinite translations from the third namespace', () => {
        expect(i18n.t('ns.3:thing', { count: 5 })).to.equal('5 things');
        expect(i18n.t('ns.3:thing', { count: 1, indefinite_article: true })).to.equal('A thing');
        expect(i18n.t('ns.3:thing', { count: 5, indefinite_article: true })).to.equal(
          'Some things',
        );
      });
    });

    describe('extended usage - indefinite articles in languages with different plural forms', () => {
      const resStore = {
        dev: {
          translation: {},
        },
        zh: {
          translation: {
            key: '__count__ thing',
            key_indefinite: 'a thing',
          },
        },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { lng: 'zh', resStore }));
      });

      it('it should provide the correct indefinite articles', () => {
        expect(i18n.t('key', { count: 1 })).to.equal('1 thing');
        expect(i18n.t('key', { count: 5 })).to.equal('5 thing');
        expect(i18n.t('key', { count: 1, indefinite_article: true })).to.equal('a thing');
        expect(i18n.t('key', { count: 5, indefinite_article: true })).to.equal('a thing');
      });
    });
  });

  describe('context usage', () => {
    describe('basic usage', () => {
      const resStore = {
        dev: {
          'ns.2': {
            friend_context: 'A friend from ns2',
            friend_context_male: 'A boyfriend from ns2',
            friend_context_female: 'A girlfriend from ns2',
          },
        },
        en: {
          'ns.1': {
            friend_context: 'A friend',
            friend_context_male: 'A boyfriend',
            friend_context_female: 'A girlfriend',
          },
        },
        'en-US': { translation: {} },
      };

      beforeEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            resStore,
            ns: { namespaces: ['ns.1', 'ns.2'], defaultNs: 'ns.1' },
          }),
        );
      });

      it('it should provide correct context form', () => {
        expect(i18n.t('friend_context')).to.equal('A friend');
        expect(i18n.t('friend_context', { context: '' })).to.equal('A friend');
        expect(i18n.t('friend_context', { context: 'male' })).to.equal('A boyfriend');
        expect(i18n.t('friend_context', { context: 'female' })).to.equal('A girlfriend');
      });

      it('it should provide correct context form for second namespace', () => {
        expect(i18n.t('ns.2:friend_context')).to.equal('A friend from ns2');
        expect(i18n.t('ns.2:friend_context', { context: '' })).to.equal('A friend from ns2');
        expect(i18n.t('ns.2:friend_context', { context: 'male' })).to.equal('A boyfriend from ns2');
        expect(i18n.t('ns.2:friend_context', { context: 'female' })).to.equal(
          'A girlfriend from ns2',
        );
      });
    });

    describe('extended usage - in combination with plurals', () => {
      const resStore = {
        dev: { translation: {} },
        en: {
          translation: {
            friend_context: '__count__ friend',
            friend_context_male: '__count__ boyfriend',
            friend_context_female: '__count__ girlfriend',
            friend_context_plural: '__count__ friends',
            friend_context_male_plural: '__count__ boyfriends',
            friend_context_female_plural: '__count__ girlfriends',
          },
        },
        'en-US': { translation: {} },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it('it should provide correct context with plural forms', () => {
        expect(i18n.t('friend_context', { count: 1 })).to.equal('1 friend');
        expect(i18n.t('friend_context', { context: '', count: 1 })).to.equal('1 friend');
        expect(i18n.t('friend_context', { context: 'male', count: 1 })).to.equal('1 boyfriend');
        expect(i18n.t('friend_context', { context: 'female', count: 1 })).to.equal('1 girlfriend');

        expect(i18n.t('friend_context', { count: 10 })).to.equal('10 friends');
        expect(i18n.t('friend_context', { context: '', count: 10 })).to.equal('10 friends');
        expect(i18n.t('friend_context', { context: 'male', count: 10 })).to.equal('10 boyfriends');
        expect(i18n.t('friend_context', { context: 'female', count: 10 })).to.equal(
          '10 girlfriends',
        );
      });
    });
  });

  describe('with passed in languages different from set one', () => {
    /** @type {import('vitest').MockInstance}  */
    let spy;
    beforeEach(() => {
      spy = vitest.spyOn(httpApi, 'read').mockImplementation(httpApiReadMockImplementation);

      return () => {
        spy.mockClear();
      };
    });

    beforeEach(async () => {
      await i18n.init(i18n.functions.extend(opts, { preload: ['de-DE'] }));
    });

    it('it should provide translation for passed in language', () => {
      expect(i18n.t('simple_de', { lng: 'de-DE' })).to.equal('ok_from_de');
    });

    describe.skip('[WONT FIX - HARD DEPRECATION OF SYNC LOADING]with language not preloaded', () => {
      it('it should provide translation for passed in language after loading file sync', () => {
        const expectedValue = i18n.clientVersion ? 'simple_fr' : 'ok_from_fr';
        expect(i18n.t('simple_fr', { lng: 'fr' })).to.equal(expectedValue);
      });
    });
  });

  describe('using sprintf', () => {
    const resStore = {
      dev: { translation: {} },
      en: { translation: {} },
      'en-US': {
        translation: {
          test: 'hi',
        },
      },
    };

    beforeEach(async () => {
      await i18n.init(i18n.functions.extend(opts, { resStore, shortcutFunction: 'defaultValue' }));
    });

    it('it should recognize the defaultValue syntax set as shortcutFunction', () => {
      expect(i18n.t('notFound', 'second param defaultValue')).to.equal('second param defaultValue');
    });
  });
});
