import { Switch } from '@base-ui/react/switch';

export default function ExampleSwitch() {
  return (
    <label className="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
      <Switch.Root
        defaultChecked
        className="flex h-5 w-9 shrink-0 border border-neutral-950 bg-white p-0.5 transition-colors duration-150 ease-[ease] dark:border-white dark:bg-neutral-950 data-checked:bg-neutral-950 dark:data-checked:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      >
        <Switch.Thumb className="size-3.5 bg-neutral-950 transition-[translate,background-color] duration-150 ease-[ease] data-checked:translate-x-4 data-checked:bg-white dark:bg-white dark:data-checked:bg-neutral-950" />
      </Switch.Root>
      Notifications
    </label>
  );
}
