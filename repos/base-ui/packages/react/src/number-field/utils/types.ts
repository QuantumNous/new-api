export type Direction = -1 | 1;

export type DirectionalChangeReason =
  | 'increment-press'
  | 'decrement-press'
  | 'wheel'
  | 'scrub'
  | 'keyboard';

export interface ChangeEventCustomProperties {
  direction?: Direction | undefined;
}

export interface IncrementValueParameters {
  direction: Direction;
  event?: Event | React.SyntheticEvent | undefined;
  reason: DirectionalChangeReason;
  currentValue?: number | null | undefined;
}

export interface EventWithOptionalKeyState {
  altKey?: boolean | undefined;
  shiftKey?: boolean | undefined;
}
