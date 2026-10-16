import { expectType } from '#test-utils';
import { createGenericEventDetails } from './createBaseUIEventDetails';
import { REASONS } from './reasons';

const incrementDetails = createGenericEventDetails(REASONS.incrementPress);
expectType<typeof REASONS.incrementPress, typeof incrementDetails.reason>(incrementDetails.reason);

const keyboardDetails = createGenericEventDetails(REASONS.keyboard);
expectType<typeof REASONS.keyboard, typeof keyboardDetails.reason>(keyboardDetails.reason);

// @ts-expect-error reason must exist in REASONS
createGenericEventDetails('invalid-reason');
