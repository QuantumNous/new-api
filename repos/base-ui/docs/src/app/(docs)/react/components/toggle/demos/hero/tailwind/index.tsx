'use client';
import * as React from 'react';
import { Toggle } from '@base-ui/react/toggle';

export default function ExampleToggle() {
  return (
    <Toggle
      aria-label="Favorite"
      className="flex size-8 items-center justify-center border-none rounded-none bg-transparent text-neutral-950 dark:text-white select-none hover:not-data-disabled:bg-neutral-100 dark:hover:not-data-disabled:bg-neutral-800 active:not-data-disabled:bg-neutral-200 dark:active:not-data-disabled:bg-neutral-700 data-pressed:text-neutral-950 dark:data-pressed:text-white focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      render={(props, state) => {
        if (state.pressed) {
          return (
            <button type="button" {...props}>
              <HeartFilledIcon />
            </button>
          );
        }

        return (
          <button type="button" {...props}>
            <HeartOutlineIcon />
          </button>
        );
      }}
    />
  );
}

function HeartFilledIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M7.99961 13.8667C7.88761 13.8667 7.77561 13.8315 7.68121 13.7611C7.43321 13.5766 1.59961 9.1963 1.59961 5.8667C1.59961 3.80856 3.27481 2.13336 5.33294 2.13336C6.59054 2.13336 7.49934 2.81176 7.99961 3.3131C8.49988 2.81176 9.40868 2.13336 10.6663 2.13336C12.7244 2.13336 14.3996 3.80803 14.3996 5.8667C14.3996 9.1963 8.56601 13.5766 8.31801 13.7616C8.22361 13.8315 8.11161 13.8667 7.99961 13.8667Z" />
    </svg>
  );
}

function HeartOutlineIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="m7.99961 4.8232-.75505-.75666c-.40333-.40419-1.0559-.86651-1.91162-.86651-1.46903 0-2.66666 1.19764-2.66666 2.66667 0 .5412.24648 1.2356.75339 2.04713.49581.79376 1.17682 1.59861 1.89311 2.33647 1.06989 1.1022 2.1604 1.9962 2.68705 2.4102.52751-.4149 1.61735-1.3085 2.68657-2.4101.7163-.73792 1.3973-1.54278 1.8932-2.33656.5069-.81154.7533-1.50594.7533-2.04714 0-1.46947-1.1975-2.66667-2.6666-2.66667-.85574 0-1.50831.46232-1.91164.86651zm-.01387-1.52394c-.5031-.49988-1.40673-1.1659-2.6528-1.1659-2.05813 0-3.73333 1.6752-3.73333 3.73334 0 3.3296 5.8336 7.7099 6.0816 7.8944a.532.532 0 0 0 .3184.1056c.112 0 .224-.0352.3184-.1051.248-.185 6.08159-4.5653 6.08159-7.8949 0-2.05867-1.6752-3.73334-3.7333-3.73334-1.24617 0-2.14985.66611-2.65293 1.166q-.0069.00686-.0137.01367c.00002-.00003-.00002.00002 0 0-.00459-.0046-.00927-.00914-.01393-.01377"
      />
    </svg>
  );
}
