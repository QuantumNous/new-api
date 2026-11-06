import { Slider } from '@base-ui/react/slider';

export default function VerticalSlider() {
  return (
    <Slider.Root orientation="vertical" defaultValue={35}>
      <Slider.Control className="flex touch-none select-none data-[orientation=vertical]:h-32 data-[orientation=vertical]:px-3">
        <Slider.Track className="bg-neutral-200 select-none dark:bg-neutral-800 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1">
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
