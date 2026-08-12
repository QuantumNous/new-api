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
});
