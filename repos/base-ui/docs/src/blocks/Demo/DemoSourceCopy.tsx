'use client';
import * as React from 'react';
import copy from 'clipboard-copy';
import { useDemoContext } from './DemoContext';

export const DemoSourceCopy = React.forwardRef<HTMLButtonElement, DemoSourceCopy.Props>(
  function DemoSource(props, forwardedRef) {
    const { onCopied, onError, onClick, render, ...other } = props;

    const { selectedFile } = useDemoContext();

    const handleClick = React.useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        try {
          await copy(selectedFile.content);
          onCopied?.();
        } catch (error) {
          onError?.(error);
        }

        onClick?.(event);
      },
      [onCopied, onError, selectedFile, onClick],
    );

    if (!selectedFile) {
      return null;
    }

    if (render) {
      return React.cloneElement(render, {
        ...other,
        onClick: handleClick,
        ref: forwardedRef,
      });
    }

    return <button type="button" {...other} onClick={handleClick} ref={forwardedRef} />;
  },
);

export namespace DemoSourceCopy {
  export interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    onCopied?: () => void;
    onError?: (error: unknown) => void;
    render?: React.ReactElement<React.ComponentPropsWithRef<'button'>>;
  }
}
