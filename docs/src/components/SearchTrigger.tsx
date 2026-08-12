'use client';
import * as React from 'react';
import clsx from 'clsx';
import { MagnifyingGlassIcon } from 'docs/src/icons/MagnifyingGlassIcon';
import { Search } from './Search';
import './SearchTrigger.css';

interface SearchTriggerProps {
  className?: string;
  containedScroll?: boolean;
  enableKeyboardShortcut?: boolean;
  /** Render a square icon-only button instead of the labelled trigger. */
  iconOnly?: boolean;
}

export function SearchTrigger({ className, iconOnly = false, ...props }: SearchTriggerProps) {
  return (
    <Search
      triggerProps={{
        className: clsx('SearchTrigger', iconOnly && 'SearchTriggerIconOnly', className),
        'aria-label': iconOnly ? 'Search' : undefined,
      }}
      {...props}
    >
      {({ isCmd }) =>
        iconOnly ? (
          <MagnifyingGlassIcon className="SearchTriggerIcon" />
        ) : (
          <React.Fragment>
            Search
            <span className="SearchTriggerShortcut">
              ({isCmd ? <kbd>⌘</kbd> : <kbd>Ctrl+</kbd>}
              <kbd>k</kbd>)
            </span>
          </React.Fragment>
        )
      }
    </Search>
  );
}
