import isNameInFieldArray from '../../logic/isNameInFieldArray';

describe('isNameInFieldArray', () => {
  it('should find match array field', () => {
    expect(isNameInFieldArray(new Set(['test']), 'test.0')).toBeTruthy();
    expect(isNameInFieldArray(new Set(['te']), 'test.0')).toBeFalsy();
    expect(isNameInFieldArray(new Set(['te']), 'test.0')).toBeFalsy();
    expect(isNameInFieldArray(new Set(['test1']), 'test[0]')).toBeFalsy();
    expect(isNameInFieldArray(new Set(['test1']), 'test.0')).toBeFalsy();
    expect(
      isNameInFieldArray(new Set(['test']), 'test.0.data[0]'),
    ).toBeTruthy();
    expect(isNameInFieldArray(new Set(['test']), 'test.0.data.0')).toBeTruthy();
    expect(isNameInFieldArray(new Set(['test']), 'test1.0.data.0')).toBeFalsy();
    expect(isNameInFieldArray(new Set(['test']), 'data.0.data.0')).toBeFalsy();
  });

  it('should find match when field array is nested under a numeric path segment', () => {
    // Field array registered at `steps.0.items`, Controller name is `steps.0.items.2.name`
    // getNodeParentName returns `steps` (first numeric segment), but the field array
    // is `steps.0.items` — so isNameInFieldArray must check deeper parents too.
    expect(
      isNameInFieldArray(new Set(['steps.0.items']), 'steps.0.items.2.name'),
    ).toBeTruthy();
    expect(
      isNameInFieldArray(new Set(['steps.0.items']), 'steps.0.items.0.value'),
    ).toBeTruthy();
    // Deeper nesting: `a.0.b.1.items`
    expect(
      isNameInFieldArray(new Set(['a.0.b.1.items']), 'a.0.b.1.items.3.name'),
    ).toBeTruthy();
    // Should still return false when there's no actual match
    expect(
      isNameInFieldArray(new Set(['steps.0.other']), 'steps.0.items.2.name'),
    ).toBeFalsy();
    // Original top-level behavior should still work
    expect(isNameInFieldArray(new Set(['items']), 'items.2.name')).toBeTruthy();
  });
});
