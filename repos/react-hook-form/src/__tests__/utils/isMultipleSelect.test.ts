import isMultipleSelect from '../../utils/isMultipleSelect';

describe('isMultipleSelect', () => {
  it('should return true when type is select-multiple', () => {
    expect(
      isMultipleSelect({ name: 'test', type: 'select-multiple' }),
    ).toBeTruthy();
  });
});
