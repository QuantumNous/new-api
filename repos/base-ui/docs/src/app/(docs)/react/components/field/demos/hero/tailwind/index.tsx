import { Field } from '@base-ui/react/field';

export default function ExampleField() {
  return (
    <Field.Root className="flex w-full max-w-64 flex-col items-start gap-1">
      <Field.Label className="text-sm font-bold text-neutral-950 dark:text-white">Name</Field.Label>
      <Field.Control
        required
        placeholder="Required"
        className="h-8 self-stretch border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white dark:placeholder:text-neutral-400"
      />
      <Field.Error className="text-sm text-red-700 dark:text-red-400" match="valueMissing">
        Please enter your name
      </Field.Error>

      <Field.Description className="text-sm text-neutral-600 dark:text-neutral-400">
        Visible on your profile
      </Field.Description>
    </Field.Root>
  );
}
