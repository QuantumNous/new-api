import createDescribe from '@mui/internal-test-utils/createDescribe';
import { testComputations } from './testComputations';
import { testLocalization } from './testLocalization';
import { testFormats } from './testFormats';
import { DescribeGregorianAdapterParameters } from './describeGregorianAdapter.types';

function innerGregorianDescribeAdapter(parameters: DescribeGregorianAdapterParameters) {
  describe(parameters.adapter.lib, () => {
    testComputations(parameters);
    testLocalization(parameters);
    testFormats(parameters);
  });
}

type DescribeGregorianAdapter = {
  (parameters: DescribeGregorianAdapterParameters): void;
  skip: (parameters: DescribeGregorianAdapterParameters) => void;
  only: (parameters: DescribeGregorianAdapterParameters) => void;
};

export const describeGregorianAdapter = createDescribe(
  'Gregorian adapter methods',
  innerGregorianDescribeAdapter,
) as DescribeGregorianAdapter;
