import { Input } from '@base-ui/react/input';

export default function ExampleInput() {
  return (
    <label className="flex flex-col items-start gap-1 text-sm font-bold text-neutral-950 dark:text-white">
      Name
      <Input
        placeholder="e.g. Colm Tuite"
        className="h-8 w-40 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white"
      />
    </label>
  );
}
