import { describe, it, expect, beforeEach, vitest } from 'vitest';
import EventEmitter from '../../src/EventEmitter';

describe('i18next', () => {
  describe('published', () => {
    /** @type {EventEmitter}  */
    let emitter;
    beforeEach(() => {
      emitter = new EventEmitter();
    });

    it('it should emit', () => {
      const activeHandler = vitest.fn();
      const disabledHandler = vitest.fn();

      expect(activeHandler).not.toHaveBeenCalled();
      expect(disabledHandler).not.toHaveBeenCalled();

      emitter.on('ok', activeHandler);
      emitter.off('nok', disabledHandler);

      emitter.emit('ok', 'data ok');
      emitter.emit('nok', 'there should be no listener');

      expect(activeHandler).toHaveBeenCalled();
      expect(activeHandler).toHaveBeenCalledWith('data ok');
      expect(disabledHandler).not.toHaveBeenCalled();
    });

    it('should emit twice if a handler was attached twice', () => {
      const calls = [];
      const listener = (payload) => {
        calls.push(payload);
      };

      emitter.on('events', listener);
      emitter.on('events', listener);
      emitter.emit('events', 1);

      expect(calls).toEqual([1, 1]);
    });

    it('it should emit wildcard', () => {
      expect.assertions(2);

      emitter.on('*', (name, payload) => {
        expect(name).to.equal('ok');
        expect(payload).to.equal('data ok');
      });

      emitter.emit('ok', 'data ok');
    });

    it('it should emit with array params', () => {
      expect.assertions(2);

      emitter.on('array-event', (array, data) => {
        expect(array).to.eql(['array ok 1', 'array ok 2']);
        expect(data).to.equal('data ok');
      });

      emitter.emit('array-event', ['array ok 1', 'array ok 2'], 'data ok');
    });

    it('it should emit wildcard with array params', () => {
      expect.assertions(3);

      // test on
      emitter.on('*', (ev, array, data) => {
        expect(ev).to.equal('array-event');
        expect(array).to.eql(['array ok 1', 'array ok 2']);
        expect(data).to.equal('data ok');
      });

      emitter.emit('array-event', ['array ok 1', 'array ok 2'], 'data ok');
    });

    it('it should return itself', () => {
      // test on
      const returned = emitter.on('*');

      expect(returned).to.equal(emitter);
    });

    it('it should correctly unbind observers', () => {
      const calls1 = [];
      const listener1 = (payload) => {
        calls1.push(payload);
      };

      const calls2 = [];
      const listener2 = (payload) => {
        calls2.push(payload);
      };

      const calls3 = [];
      const listener3 = (payload) => {
        calls3.push(payload);
      };

      emitter.on('events', listener1);
      emitter.on('events', listener2);
      emitter.on('events', listener3);
      emitter.on('events', listener1);

      emitter.emit('events', 1);
      emitter.off('events', listener1);
      emitter.emit('events', 2);
      emitter.off('events', listener2);
      emitter.emit('events', 3);
      emitter.off('events', listener2);
      emitter.off('events');
      emitter.emit('events', 4);

      expect(calls1).to.eql([1, 1]);
      expect(calls2).to.eql([1, 2]);
      expect(calls3).to.eql([1, 2, 3]);
    });
  });
});
