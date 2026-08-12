// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { Event } from '../../../src/event/event';
import { EventDispatcher } from '../../../src/event/event-dispatcher';

describe('[event] Event', () => {
  let eventA;
  let eventB;

  beforeEach(() => {
    const eventDispatcher = new EventDispatcher(
      {} as any,
      {
        addEventListener: () => {},
        removeEventListener: () => {}
      } as any
    );
    eventA = new Event(eventDispatcher, 'desktop-browser');
    eventB = new Event(eventDispatcher, 'desktop-browser');
  });

  test('emit event', () => {
    const eventSpy = jest.fn();
    eventA.on('custom event', eventSpy);
    eventB.emit('custom event', { value: 'Event Trigger!' });
    expect(eventSpy).toBeCalledTimes(1);
  });

  test('off event', () => {
    const eventSpy = jest.fn();
    eventA.on('custom event', eventSpy);
    eventA.off('custom event', eventSpy);
    eventB.emit('custom event', { value: 'Off Event Trigger!' });
    expect(eventSpy).not.toBeCalled();
    expect(eventA._eventDispatcher._viewBubbles.size).toBe(0);
  });

  test('event filter', () => {
    const itemMap = new Map<string, any>();
    itemMap.set('bar', null);
    const event1Spy = jest.fn();
    const event2Spy = jest.fn();
    const event3Spy = jest.fn();
    const event4Spy = jest.fn();
    const event5Spy = jest.fn();

    eventA.on('event1', { nodeName: 'axis-label' }, event1Spy);
    eventA.on('event2', { type: 'bar' }, event2Spy);
    eventA.on('event2', { type: 'bar', level: 'model' }, event2Spy);
    eventA.on('event3', { markName: 'bar' }, event3Spy);
    eventA.on('event4', { id: 'bar0' }, event4Spy);
    eventA.on('event5', { filter: ({ model }) => model.id === 4 }, event5Spy);

    eventB.emit('event1', { node: { name: 'axis-label' } });
    eventB.emit('event2', { model: { type: 'bar', userId: 'bar0' } });
    eventB.emit('event3', {
      model: { type: 0, userId: 'bar0' },
      mark: { name: 'bar', getProductId: () => 'bar' },
      itemMap
    });
    eventB.emit('event4', { model: { type: 'bar', userId: 'bar0' }, itemMap });
    eventB.emit('event5', { model: { type: 'bar', userId: 'bar0', id: 4 }, itemMap });

    expect(event1Spy).toBeCalledTimes(1);
    expect(event2Spy).toBeCalledTimes(2);
    expect(event3Spy).toBeCalledTimes(1);
    expect(event4Spy).toBeCalledTimes(1);
    expect(event5Spy).toBeCalledTimes(1);
  });
});
