import { Link as RouterLink, createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { LoaderCircle } from 'lucide-react';
import clsx from 'clsx';
import * as Combobox from '@/components/combobox';
import { Link, styles as linkStyles } from '@/components/link';

const getData = createServerFn({
  method: 'GET',
}).handler(async () => {
  // Mimic server response time
  await new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });

  return [
    { value: 'js', label: 'JavaScript' },
    { value: 'ts', label: 'TypeScript' },
    { value: 'py', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'cs', label: 'C#' },
    { value: 'php', label: 'PHP' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'swift', label: 'Swift' },
  ];
});

function Loading() {
  return (
    <div className="min-h-dvh flex justify-center items-center">
      <LoaderCircle className="size-8 animate-spin" />
    </div>
  );
}

export const Route = createFileRoute('/combobox-server-fn')({
  component: RouteComponent,
  loader: async () => await getData(),
  pendingComponent: Loading,
});

function RouteComponent() {
  const items = Route.useLoaderData();

  return (
    <div className="min-h-dvh flex justify-center items-center">
      <main className="flex flex-col items-start gap-4">
        <p className="text-sm">
          The combobox <code>items</code> are loaded <br />
          using a{' '}
          <Link href="https://tanstack.com/start/latest/docs/framework/react/guide/server-functions">
            Server Function
          </Link>
          .
        </p>
        <Combobox.Root items={items} onValueChange={console.log}>
          <div className="relative flex flex-col gap-1 text-sm leading-5 font-medium">
            <Combobox.Input placeholder="e.g. TypeScript" />
            <div className="absolute right-1 bottom-0 flex items-center h-8 text-gray-600 dark:text-gray-400">
              <Combobox.Clear />
              <Combobox.Trigger />
            </div>
          </div>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Empty>No matches</Combobox.Empty>
                <Combobox.List>
                  {(lang) => {
                    return (
                      <Combobox.Item key={lang.value} value={lang}>
                        <Combobox.ItemIndicator />
                        <div className="col-start-2">{lang.label}</div>
                      </Combobox.Item>
                    );
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
        <RouterLink className={clsx(linkStyles, 'text-sm')} to="/">
          Go back
        </RouterLink>
      </main>
    </div>
  );
}
