import getNodeParentName from '../../logic/getNodeParentName';

describe('getNodeParentName', () => {
  it('should return parent name when name is field array', () => {
    expect(getNodeParentName('test.0')).toBe('test');
    expect(getNodeParentName('test1.1')).toBe('test1');
    expect(getNodeParentName('test.0.data.0')).toBe('test');
    expect(getNodeParentName('test.data.0')).toBe('test.data');
    expect(getNodeParentName('test.1st')).toBe('test.1st');
  });

  it('should return empty string when name is not field array', () => {
    expect(getNodeParentName('test')).toBe('test');
    expect(getNodeParentName('test0')).toBe('test0');
    expect(getNodeParentName('te1st')).toBe('te1st');
  });
});
