import { expectType } from '#test-utils';
import { Slider } from '@base-ui/react/slider';
import { REASONS } from '../../internals/reasons';

const value: number = 25;
const array = [25];

const singleValueWithOnValueChange = (
  <Slider.Root value={value} onValueChange={(v) => expectType<number, typeof v>(v)} />
);
const singleDefaultValueWithOnValueChange = (
  <Slider.Root defaultValue={25} onValueChange={(v) => expectType<number, typeof v>(v)} />
);

const arrayValueWithOnValueChange = (
  <Slider.Root value={array} onValueChange={(v) => expectType<number[], typeof v>(v)} />
);
const arrayDefaultValueWithOnValueChange = (
  <Slider.Root defaultValue={[25]} onValueChange={(v) => expectType<number[], typeof v>(v)} />
);

const singleValueWithOnValueCommitted = (
  <Slider.Root value={value} onValueCommitted={(v) => expectType<number, typeof v>(v)} />
);
const singleDefaultValueWithOnValueCommitted = (
  <Slider.Root defaultValue={25} onValueCommitted={(v) => expectType<number, typeof v>(v)} />
);

const arrayValueWithOnValueCommitted = (
  <Slider.Root value={array} onValueCommitted={(v) => expectType<number[], typeof v>(v)} />
);
const arrayDefaultValueWithOnValueCommitted = (
  <Slider.Root defaultValue={[25]} onValueCommitted={(v) => expectType<number[], typeof v>(v)} />
);

const singleValueExplicitTypeAnnotation = (
  <Slider.Root<number> onValueChange={(v) => expectType<number, typeof v>(v)} />
);
const arrayValueExplicitTypeAnnotation = (
  <Slider.Root<number[]> onValueChange={(v) => expectType<number[], typeof v>(v)} />
);

type SliderChangeHandler = NonNullable<Slider.Root.Props['onValueChange']>;
type SliderCommitHandler = NonNullable<Slider.Root.Props['onValueCommitted']>;

type SliderChangeDetails = Parameters<SliderChangeHandler>[1];

function assertSliderChange(details: SliderChangeDetails) {
  if (details.reason === REASONS.drag) {
    const event: PointerEvent | TouchEvent = details.event;
    void event;
    // @ts-expect-error pointer drag does not emit wheel events
    const wheelEvent: WheelEvent = details.event;
    void wheelEvent;
  }

  if (details.reason === REASONS.keyboard) {
    const event: KeyboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.trackPress) {
    const event: PointerEvent | MouseEvent | TouchEvent = details.event;
    void event;
  }
}

type SliderCommitDetails = Parameters<SliderCommitHandler>[1];

function assertSliderCommit(details: SliderCommitDetails) {
  if (details.reason === REASONS.drag) {
    const event: PointerEvent | TouchEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputChange) {
    const event: InputEvent | Event = details.event;
    void event;
  }
}

const handleSliderChange: SliderChangeHandler = (v, details) => {
  expectType<number | readonly number[], typeof v>(v);
  assertSliderChange(details);
};

const handleSliderCommit: SliderCommitHandler = (v, details) => {
  expectType<number | readonly number[], typeof v>(v);
  assertSliderCommit(details);
};

const sliderReasonNarrowing = (
  <Slider.Root
    defaultValue={25}
    onValueChange={handleSliderChange}
    onValueCommitted={handleSliderCommit}
  />
);
