import { Slider } from '@base-ui/react/slider';

export default function EdgeAlignedThumb() {
  return (
    <Slider.Root thumbAlignment="edge" defaultValue={25}>
      <Slider.Control className="flex w-56 touch-none items-center py-3 select-none">
        <Slider.Track className="h-1 w-full bg-neutral-200 select-none dark:bg-neutral-800">
          <Slider.Indicator className="bg-neutral-950 select-none dark:bg-white" />
          <Slider.Thumb
            aria-label="Volume"
            className="size-4 border border-neutral-950 bg-white select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-950 dark:has-[:focus-visible]:outline-white dark:border-white dark:bg-neutral-950"
          />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
