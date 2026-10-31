// TODO: Remove if temporal adapters are supported
// @ts-nocheck No types available
import { DateTime, Settings } from 'luxon';
import { describeGregorianAdapter } from '#test-utils';
import { TemporalAdapterLuxon } from './TemporalAdapterLuxon';

describe('TemporalAdapterLuxon', () => {
  describeGregorianAdapter({
    adapter: new TemporalAdapterLuxon(),
    adapterFr: new TemporalAdapterLuxon({ locale: 'fr' }),
    setDefaultTimezone: (timezone) => {
      Settings.defaultZone = timezone ?? 'system';
    },
    createDateInFrenchLocale: (dateStr) => DateTime.fromISO(dateStr, { locale: 'fr' }),
  });
});
