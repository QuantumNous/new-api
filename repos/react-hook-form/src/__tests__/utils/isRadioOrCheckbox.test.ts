import isRadioOrCheckbox from '../../utils/isRadioOrCheckbox';

describe('isRadioOrCheckbox', () => {
  it('should return true when type is either radio or checkbox', () => {
    expect(isRadioOrCheckbox({ name: 'test', type: 'radio' })).toBeTruthy();
    expect(isRadioOrCheckbox({ name: 'test', type: 'checkbox' })).toBeTruthy();
  });

  it('shoudl return false when type is neither radio nor checkbox', () => {
    expect(isRadioOrCheckbox({ name: 'test', type: 'text' })).toBeFalsy();
    expect(isRadioOrCheckbox({ name: 'test', type: 'email' })).toBeFalsy();
    expect(isRadioOrCheckbox({ name: 'test', type: 'date' })).toBeFalsy();
  });
});
