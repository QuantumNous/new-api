import { Meter } from '@base-ui/react/meter';

export default function ExampleMeter() {
  return (
    <Meter.Root className="grid max-w-full w-60 grid-cols-2 gap-y-2" value={24}>
      <Meter.Label className="text-sm font-normal text-neutral-950 dark:text-white">
        Storage Used
      </Meter.Label>
      <Meter.Value className="text-right text-sm text-neutral-950 dark:text-white" />
      <Meter.Track className="col-span-2 h-3 overflow-hidden bg-neutral-200 dark:bg-neutral-800">
        <Meter.Indicator className="bg-neutral-950 transition-[width] duration-500 dark:bg-white" />
      </Meter.Track>
    </Meter.Root>
  );
}
