import isHTMLElement from '../../utils/isHTMLElement';

describe('isHTMLElement', () => {
  it('should return true when value is HTMLElement', () => {
    expect(isHTMLElement(document.createElement('input'))).toBeTruthy();
  });

  it('should return true when HTMLElement is inside an iframe', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);

    const iframeDocument = iframe.contentDocument!;
    const input = iframeDocument.createElement('input');
    iframeDocument.body.append(input);
    expect(isHTMLElement(input)).toBeTruthy();
  });
});
