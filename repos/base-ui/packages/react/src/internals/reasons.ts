import * as REASONS from './reason-parts';

export { REASONS };
export type BaseUIEventReasons = typeof REASONS;
export type BaseUIEventReason = BaseUIEventReasons[keyof BaseUIEventReasons];
