import skipValidation from '../../logic/skipValidation';

describe('should skip validation', () => {
  it('when is onChange mode and blur event', () => {
    expect(
      skipValidation(
        false,
        false,
        false,
        {
          isOnChange: true,
          isOnBlur: false,
        },
        {
          isOnChange: true,
          isOnBlur: true,
          isOnTouch: false,
        },
      ),
    ).toBeTruthy();
  });

  it('when is onSubmit mode and re-validate on Submit', () => {
    expect(
      skipValidation(
        false,
        false,
        false,
        {
          isOnChange: false,
          isOnBlur: false,
        },
        {
          isOnChange: false,
          isOnBlur: false,
          isOnTouch: false,
        },
      ),
    ).toBeTruthy();
  });

  it('when is onSubmit mode and not submitted yet', () => {
    expect(
      skipValidation(
        false,
        false,
        false,
        {
          isOnChange: true,
          isOnBlur: false,
        },
        {
          isOnChange: false,
          isOnBlur: false,
          isOnTouch: false,
        },
      ),
    ).toBeTruthy();
  });

  it('when on blur mode, not blur event and error gets clear', () => {
    expect(
      skipValidation(
        false,
        false,
        false,
        {
          isOnChange: true,
          isOnBlur: false,
        },
        {
          isOnChange: false,
          isOnBlur: true,
          isOnTouch: false,
        },
      ),
    ).toBeTruthy();
  });

  it('when re-validate mode is blur, not blur event and has error ', () => {
    expect(
      skipValidation(
        false,
        false,
        true,
        {
          isOnChange: true,
          isOnBlur: true,
        },
        {
          isOnChange: false,
          isOnBlur: false,
          isOnTouch: false,
        },
      ),
    ).toBeTruthy();
  });

  it('when is re-validate mode on submit and have error', () => {
    expect(
      skipValidation(
        false,
        false,
        true,
        {
          isOnChange: false,
          isOnBlur: false,
        },
        {
          isOnChange: false,
          isOnBlur: false,
          isOnTouch: false,
        },
      ),
    ).toBeTruthy();
  });
});

describe('should validate the input', () => {
  it('when form is submitted and there is error', () => {
    expect(
      skipValidation(
        false,
        false,
        true,
        {
          isOnChange: true,
          isOnBlur: false,
        },
        {
          isOnChange: false,
          isOnBlur: false,
          isOnTouch: false,
        },
      ),
    ).toBeFalsy();
  });

  it('when mode is under all', () => {
    expect(
      skipValidation(
        false,
        false,
        false,
        {
          isOnChange: false,
          isOnBlur: false,
        },
        {
          isOnChange: false,
          isOnBlur: false,
          isOnAll: true,
        },
      ),
    ).toBeFalsy();
  });

  it('when user blur input and there is no more error', () => {
    expect(
      skipValidation(
        true,
        false,
        false,
        {
          isOnChange: true,
          isOnBlur: false,
        },
        {
          isOnChange: false,
          isOnBlur: true,
          isOnTouch: false,
        },
      ),
    ).toBeFalsy();
  });

  it('when user blur and there is an error', () => {
    expect(
      skipValidation(
        true,
        false,
        false,
        {
          isOnChange: true,
          isOnBlur: false,
        },
        {
          isOnChange: false,
          isOnBlur: true,
          isOnTouch: false,
        },
      ),
    ).toBeFalsy();
  });
});
