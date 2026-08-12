import { describe, it, expect, beforeEach, vitest } from 'vitest';
import ResourceStore from '../../src/ResourceStore.js';

describe('ResourceStore', () => {
  describe('constructor', () => {
    it('it should set empty data if not passing them in', () => {
      const rs = new ResourceStore();
      expect(rs.toJSON()).to.eql({});
    });

    it('it should set data if passing them in', () => {
      const data = {
        en: {
          translation: {
            test: 'test',
          },
        },
      };
      const rs = new ResourceStore(data);
      expect(rs.toJSON()).to.equal(data);
    });
  });

  describe('resource manipulation', () => {
    /** @type {ResourceStore} */
    let rs;

    describe('can add resources', () => {
      beforeEach(() => {
        const data = { en: { translation: { test: 'test' } } };
        rs = new ResourceStore(data);
      });

      it('it adds resources by addResource', () => {
        // basic key
        rs.addResource('de', 'translation', 'test', 'test');
        expect(rs.getResource('de', 'translation', 'test')).to.equal('test');

        // dotted key
        rs.addResource('de', 'translation', 'nest.test', 'test_nest');
        expect(rs.getResource('de', 'translation', 'nest.test')).to.equal('test_nest');

        // using first param fullDot
        rs.addResource('de.translation.nest.fullDot', 'test_fullDot');
        expect(rs.getResource('de.translation.nest.fullDot')).to.equal('test_fullDot');

        // setting object
        rs.addResource('de.translation.nest.object', { something: 'deeper' });
        expect(rs.getResource('de.translation.nest.object.something')).to.equal('deeper');

        // getting object
        expect(rs.getResource('de.translation.nest.object')).to.eql({ something: 'deeper' });
      });

      it("it should emit 'added' event on addResource call", () => {
        const spy = vitest.fn();
        rs.on('added', spy);
        rs.addResource('fr', 'translation', 'hi', 'salut');
        expect(spy).toHaveBeenCalledWith('fr', 'translation', 'hi', 'salut');
      });

      it("it should not emit 'added' event on addResource call with silent option", () => {
        const spy = vitest.fn();
        rs.on('added', spy);
        rs.addResource('fr', 'translation', 'hi', 'salut', { silent: true });
        expect(spy).not.toHaveBeenCalled();
      });

      it("it should emit 'added' event on addResources call", () => {
        const spy = vitest.fn();
        rs.on('added', spy);
        rs.addResources('fr', 'translation', {
          hi: 'salut',
          hello: 'bonjour',
        });
        expect(spy).toHaveBeenCalledOnce();
      });

      it("it should not emit 'added' event on addResources call with silent option", () => {
        const spy = vitest.fn();
        rs.on('added', spy);
        rs.addResources(
          'fr',
          'translation',
          {
            hi: 'salut',
            hello: 'bonjour',
          },
          { silent: true },
        );
        expect(spy).not.toHaveBeenCalled();
      });

      it("it should emit 'added' event on addResourceBundle call", () => {
        const spy = vitest.fn();
        rs.on('added', spy);
        rs.addResourceBundle(
          'fr',
          'translation',
          {
            hi: 'salut',
            hello: 'bonjour',
          },
          true,
          true,
        );
        expect(spy).toHaveBeenCalledOnce();
      });

      it("it should not emit 'added' event on addResourceBundle call with silent option", () => {
        const spy = vitest.fn();
        rs.on('added', spy);
        rs.addResourceBundle(
          'fr',
          'translation',
          {
            hi: 'salut',
            hello: 'bonjour',
          },
          true,
          true,
          { silent: true },
        );
        expect(spy).not.toHaveBeenCalled();
      });

      it('it should also addResources nested in wrong way', () => {
        rs.addResources('fr', 'translation', {
          'a.key': 'first',
          'a.key.deep': 'second',
          'a.key.deep.deeper': 'third',
          'a.key.deeper': 'fourth',
          'b.k': 'fifth',
        });
        expect(rs.getResource('fr.translation.a.key')).to.eql('first');
        expect(rs.getResource('fr.translation.a.key.deep')).to.eql('second');
        expect(rs.getResource('fr.translation.a.key.deep.deeper')).to.eql('third');
        expect(rs.getResource('fr.translation.a.key.deeper')).to.eql('fourth');
        expect(rs.getResource('fr.translation.b.k')).to.eql('fifth');
      });
    });

    describe('can extend resources bundle', () => {
      beforeEach(() => {
        const data = { en: { translation: { test: 'test' } } };
        rs = new ResourceStore(data);
      });

      it('it adds resources by addResourceBundle', () => {
        rs.addResourceBundle('en', 'translation', { something: 'deeper' });
        expect(rs.getResource('en', 'translation')).to.eql({ something: 'deeper', test: 'test' });

        // dotty
        rs.addResourceBundle('en.translation', { something1: 'deeper1' });
        expect(rs.getResource('en.translation')).to.eql({
          something: 'deeper',
          something1: 'deeper1',
          test: 'test',
        });
      });

      it('without polluting the prototype by __proto__', () => {
        const maliciousPayload = '{"__proto__":{"vulnerable":"Polluted"}}';
        rs.addResourceBundle('en', 'translation', JSON.parse(maliciousPayload), true, true);
        expect({}.vulnerable).to.eql(undefined);
      });

      it('without polluting the prototype by constructor', () => {
        const maliciousPayload = '{"constructor": {"prototype": {"polluted": "yes"}}}';
        rs.addResourceBundle('en', 'translation', JSON.parse(maliciousPayload), true);
        expect({}.polluted).to.eql(undefined);
      });
    });

    describe('can check resources bundle', () => {
      beforeEach(() => {
        const data = { en: { translation: { test: 'test' } } };
        rs = new ResourceStore(data);
      });

      it('it checks resources by hasResourceBundle', () => {
        expect(rs.hasResourceBundle('en', 'translation')).toBeTruthy();
        expect(rs.hasResourceBundle('en', 'notExisting')).toBeFalsy();
      });
    });

    describe('can get resources bundle', () => {
      beforeEach(() => {
        const data = { en: { translation: { test: 'test' } } };
        rs = new ResourceStore(data);
      });

      it('it get resources by getResourceBundle', () => {
        expect(rs.getResourceBundle('en', 'translation')).to.be.eql({ test: 'test' });
      });
    });

    describe('can remove resources bundle', () => {
      beforeEach(() => {
        const data = { en: { translation: { test: 'test' } } };
        rs = new ResourceStore(data);
      });

      it('it removes resources by removeResourceBundle', () => {
        rs.removeResourceBundle('en', 'translation');
        expect(rs.getResourceBundle('en', 'translation')).toBeFalsy();
      });
    });

    describe('can get data by language', () => {
      beforeEach(() => {
        const data = { en: { translation: { test: 'test' } } };
        rs = new ResourceStore(data);
      });

      it('it gets data by getDataByLanguage', () => {
        expect(rs.getDataByLanguage('en')).to.be.eql({ translation: { test: 'test' } });
      });
    });
  });
});
