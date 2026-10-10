import type { Ref } from '../../types';
import isHTMLElement from '../../utils/isHTMLElement';
import live from '../../utils/live';

jest.mock('../../utils/isHTMLElement');

const mockIsHTMLElement = isHTMLElement as jest.MockedFunction<
  typeof isHTMLElement
>;

describe('live', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return true when ref is HTMLElement and connected', () => {
    mockIsHTMLElement.mockReturnValue(true);
    const ref: Ref = { isConnected: true, name: 'mock' };
    expect(live(ref)).toBe(true);
  });

  it('should return false when ref is not connected', () => {
    mockIsHTMLElement.mockReturnValue(true);
    const ref: Ref = { isConnected: false, name: 'mock' };
    expect(live(ref)).toBe(false);
  });

  it('should return false when ref is not an HTMLElement', () => {
    mockIsHTMLElement.mockReturnValue(false);
    const ref: Ref = { isConnected: false, name: 'mock' };
    expect(live(ref)).toBe(false);
  });
});
