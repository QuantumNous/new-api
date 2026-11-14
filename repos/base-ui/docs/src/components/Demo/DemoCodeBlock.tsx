import * as React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import * as ScrollArea from '../ScrollArea';

interface DemoCodeBlockProps {
  selectedFile: React.ReactNode;
  selectedFileLines: number;
  collapsibleOpen: boolean;
  /** How many lines should the code block have to get collapsed instead of rendering fully */
  collapsibleLinesThreshold?: number;
  collapsibleTriggerRef: React.Ref<HTMLSpanElement>;
  copyButton: React.ReactNode;
}

function Root(props: React.ComponentProps<typeof ScrollArea.Root>) {
  return (
    <ScrollArea.Root
      {...props}
      className="DemoCodeBlockRoot"
      tabIndex={-1}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          String.fromCharCode(event.keyCode) === 'A' &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          window.getSelection()?.selectAllChildren(event.currentTarget);
        }
      }}
    />
  );
}

export function DemoCodeBlock({
  selectedFile,
  selectedFileLines,
  collapsibleOpen,
  collapsibleLinesThreshold = 12,
  collapsibleTriggerRef,
  copyButton,
}: DemoCodeBlockProps) {
  if (selectedFileLines < collapsibleLinesThreshold) {
    return (
      <Root>
        <ScrollArea.Viewport>
          <div className="DemoSourceBrowser">{selectedFile}</div>
        </ScrollArea.Viewport>
        <ScrollArea.Corner />
        <ScrollArea.Scrollbar orientation="vertical" />
        <ScrollArea.Scrollbar orientation="horizontal" />
        {copyButton}
      </Root>
    );
  }

  return (
    <div className="DemoCodeBlockCollapsible">
      <Root data-closed={collapsibleOpen ? undefined : ''}>
        <Collapsible.Panel
          keepMounted
          hidden={false}
          render={
            <ScrollArea.Viewport
              aria-hidden={!collapsibleOpen}
              data-closed={collapsibleOpen ? undefined : ''}
              className="DemoCodeBlockViewport"
              {...(!collapsibleOpen && { tabIndex: undefined, style: { overflow: undefined } })}
            />
          }
        >
          <div className="DemoSourceBrowser">{selectedFile}</div>
        </Collapsible.Panel>

        {collapsibleOpen && (
          <React.Fragment>
            <ScrollArea.Corner />
            <ScrollArea.Scrollbar orientation="vertical" />
            <ScrollArea.Scrollbar orientation="horizontal" />
          </React.Fragment>
        )}
        {copyButton}

        <Collapsible.Trigger
          className="DemoCollapseButton"
          data-sticky={collapsibleOpen ? '' : undefined}
        >
          <span ref={collapsibleTriggerRef} className="DemoCollapseButtonVisual">
            {collapsibleOpen ? 'Hide code' : 'Show code'}
          </span>
        </Collapsible.Trigger>
      </Root>
    </div>
  );
}
