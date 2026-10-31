import shouldSubscribeByName from '../../logic/shouldSubscribeByName';

describe('shouldSubscribeByName', () => {
  it('should return correct response for subscription name coverage', () => {
    expect(shouldSubscribeByName(undefined, 'test')).toBeTruthy();
    expect(shouldSubscribeByName('test', undefined)).toBeTruthy();
    expect(shouldSubscribeByName(['test'], undefined)).toBeTruthy();
    expect(shouldSubscribeByName(['test'], 'test')).toBeTruthy();
    expect(shouldSubscribeByName(['tes'], 'test')).toBeTruthy();
    expect(shouldSubscribeByName(['test1'], 'test')).toBeTruthy();
    expect(shouldSubscribeByName('test1', 'test')).toBeTruthy();
    expect(shouldSubscribeByName('tes', 'test')).toBeTruthy();

    expect(shouldSubscribeByName('testXXX', 'data')).toBeFalsy();
    expect(shouldSubscribeByName(['testXXX'], 'data')).toBeFalsy();
  });

  it('should notify exact subscribers when an ancestor path changes', () => {
    // A field subscribed exactly to `data.type` must still be notified when
    // its parent object `data` is replaced (e.g. set to null), because that
    // change affects the nested value.
    expect(shouldSubscribeByName('data.type', 'data', true)).toBeTruthy();
    expect(shouldSubscribeByName(['data.type'], 'data', true)).toBeTruthy();
    expect(shouldSubscribeByName('data.type', 'data.type', true)).toBeTruthy();

    // It must not match sibling or substring-only names under exact matching.
    expect(shouldSubscribeByName('database', 'data', true)).toBeFalsy();
    expect(shouldSubscribeByName('data.other', 'data.type', true)).toBeFalsy();
    expect(shouldSubscribeByName('data', 'data.type', true)).toBeFalsy();
  });
});
