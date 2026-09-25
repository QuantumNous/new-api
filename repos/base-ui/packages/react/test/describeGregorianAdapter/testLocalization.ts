import { expect } from 'vitest';
import { DescribeGregorianAdapterTestSuite } from './describeGregorianAdapter.types';

export const testLocalization: DescribeGregorianAdapterTestSuite = ({ adapter }) => {
  it('Method: getCurrentLocaleCode', () => {
    // TODO: When adding the moment adapter
    // if (adapter.lib === 'moment') {
    //   moment.locale('en');
    // }

    // Returns the default locale
    expect(adapter.getCurrentLocaleCode()).toMatch(/en/);
  });
};
