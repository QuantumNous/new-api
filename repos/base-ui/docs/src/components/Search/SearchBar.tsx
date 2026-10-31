'use client';
import * as React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useSearch } from '@mui/internal-docs-infra/useSearch';
import type {
  SearchResult,
  SearchResults,
  Sitemap,
} from '@mui/internal-docs-infra/useSearch/types';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { Dialog } from '@base-ui/react/dialog';
import { ScrollArea } from '@base-ui/react/scroll-area';
import { CornerDownLeft } from 'lucide-react';
import { useGoogleAnalytics } from 'docs/src/blocks/GoogleAnalyticsProvider';
import { MagnifyingGlassIcon } from 'docs/src/icons/MagnifyingGlassIcon';
import { stringToUrl } from '../QuickNav/rehypeSlug.mjs';

const showPrivatePages = process.env.SHOW_PRIVATE_PAGES === 'true';

// Semver pattern to detect version headings (e.g., v1.0.0, v1.0.0-rc.0)
// Used to match the behavior of rehypeConcatHeadings on the Releases page
const SEMVER_PATTERN =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Slugify function that handles parent context concatenation.
 * Matches the behavior of rehypeConcatHeadings for Releases/Forms pages
 * where child heading IDs are prefixed with parent heading text.
 */
function slugifyWithParentContext(text: string, parentTitles?: string[]): string {
  const slug = stringToUrl(text);

  // If there's a parent title that looks like a semver version, prepend it
  // This matches the behavior of rehypeConcatHeadings on the Releases page
  // which generates IDs like: v1.0.0-rc.0-autocomplete
  if (parentTitles?.length && SEMVER_PATTERN.test(parentTitles[0])) {
    return `${parentTitles[0]}-${slug}`;
  }

  return slug;
}

function normalizeGroup(group: string) {
  return group.replace(/\s+Pages$/, '').replace(/^React\s+/, '');
}

const SearchItem = React.memo(function SearchItem({ result }: { result: SearchResult }) {
  return (
    <React.Fragment>
      {result.title?.split(' ‣ ').map((part, i, arr) => (
        <React.Fragment key={part}>
          <span className={clsx('SearchBreadcrumbPart', i === arr.length - 1 && 'last')}>
            {part}
          </span>
          {i !== arr.length - 1 && (
            <svg
              className="SearchBreadcrumbSeparator"
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                fill="currentColor"
                fillRule="evenodd"
                d="M5.47 13.03a.75.75 0 0 1 0-1.06L9.44 8 5.47 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0"
                clipRule="evenodd"
              />
            </svg>
          )}
        </React.Fragment>
      ))}
      {process.env.NODE_ENV !== 'production' && result.score && (
        <span className="SearchScore">{result.score.toFixed(2)}</span>
      )}
    </React.Fragment>
  );
});

const EmptyState = React.memo(function EmptyState() {
  return <Autocomplete.Status className="SearchEmptyState">No results found.</Autocomplete.Status>;
});

export interface SearchBarProps {
  handle: Dialog.Handle<unknown>;
  sitemap: () => Promise<{ sitemap?: Sitemap }>;
  containedScroll?: boolean;
}

export function SearchBar({
  handle,
  sitemap: sitemapImport,
  containedScroll = false,
}: SearchBarProps) {
  const [dialogOpen, setDialogOpen] = React.useState(handle.isOpen);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const ga = useGoogleAnalytics();

  // Search session tracking
  const searchQueryRef = React.useRef('');
  const resultCountRef = React.useRef(0);
  const attemptRef = React.useRef(0);
  const selectedResultRef = React.useRef<SearchResult | null>(null);
  const lastTrackedQueryRef = React.useRef('');
  const queryDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up pending debounce on unmount
  React.useEffect(() => {
    return () => {
      if (queryDebounceRef.current) {
        clearTimeout(queryDebounceRef.current);
      }
    };
  }, []);

  // Use the generic search hook with Base UI specific configuration
  const { results, search, defaultResults, buildResultUrl } = useSearch({
    sitemap: sitemapImport,
    generateSlug: slugifyWithParentContext,
    tolerance: 0,
    limit: 20,
    enableStemming: true,
    includeCategoryInGroup: true,
    excludeSections: true,
    showPrivatePages,
  });

  // Update search results when hook results change
  const [searchResults, setSearchResults] =
    React.useState<ReturnType<typeof useSearch>['results']>(defaultResults);
  React.useEffect(() => {
    // Track result count for the current query
    const totalResults = results.results.reduce((sum, group) => sum + group.items.length, 0);
    resultCountRef.current = totalResults;

    const updateResults = () => {
      setSearchResults(results);
    };

    // Delay empty results to avoid flashing "No results" while typing
    if (results.results.length === 0) {
      const timeoutId = setTimeout(updateResults, 400);
      return () => clearTimeout(timeoutId);
    }

    updateResults();
    return undefined;
  }, [results]);

  const handleOpenDialog = React.useCallback(() => {
    // Reset search session tracking
    searchQueryRef.current = '';
    resultCountRef.current = 0;
    attemptRef.current = 0;
    selectedResultRef.current = null;
    lastTrackedQueryRef.current = '';
    if (queryDebounceRef.current) {
      clearTimeout(queryDebounceRef.current);
      queryDebounceRef.current = null;
    }
    ga?.trackEvent({ category: 'search', action: 'open' });
    setDialogOpen(true);
  }, [ga]);

  const handleCloseDialog = React.useCallback(
    (open: boolean) => {
      if (!open) {
        // Cancel any pending debounced query event
        if (queryDebounceRef.current) {
          clearTimeout(queryDebounceRef.current);
          queryDebounceRef.current = null;
        }

        // Fire final search event for the current query
        if (searchQueryRef.current) {
          const selected = selectedResultRef.current;
          ga?.trackEvent({
            category: 'search',
            action: selected ? 'select' : 'dismiss',
            label: searchQueryRef.current,
            params: {
              search_term: searchQueryRef.current,
              result_count: resultCountRef.current,
              attempt: attemptRef.current,
              ...(selected
                ? {
                    selected_result: selected.title || selected.slug,
                    selected_type: selected.type || '',
                  }
                : { failed: searchQueryRef.current }),
            },
          });
          lastTrackedQueryRef.current = searchQueryRef.current;
        }

        setDialogOpen(false);

        // Wait for the closing animation to complete before resetting state
        setTimeout(() => {
          setSearchResults(defaultResults);
        }, 200);
      } else {
        handleOpenDialog();
      }
    },
    [handleOpenDialog, defaultResults, ga],
  );

  const handleAutocompleteEscape = React.useCallback(
    (open: boolean, eventDetails: Autocomplete.Root.ChangeEventDetails) => {
      if (!open && eventDetails.reason === 'escape-key') {
        handleCloseDialog(false);
      }
    },
    [handleCloseDialog],
  );

  const handleValueChange = React.useCallback(
    async (value: string) => {
      // Cancel any pending debounced query event
      if (queryDebounceRef.current) {
        clearTimeout(queryDebounceRef.current);
        queryDebounceRef.current = null;
      }

      const previousLength = searchQueryRef.current?.length ?? 0;
      searchQueryRef.current = value;
      if (value) {
        // Increment attempt when starting a new query (transition from empty to non-empty)
        if (previousLength === 0 && value.length > 0) {
          attemptRef.current += 1;
        }

        // Fire a debounced 'query' event when the user pauses typing
        queryDebounceRef.current = setTimeout(() => {
          if (searchQueryRef.current && searchQueryRef.current !== lastTrackedQueryRef.current) {
            ga?.trackEvent({
              category: 'search',
              action: 'query',
              label: searchQueryRef.current,
              params: {
                search_term: searchQueryRef.current,
                result_count: resultCountRef.current,
                attempt: attemptRef.current,
              },
            });
            lastTrackedQueryRef.current = searchQueryRef.current;
          }
        }, 1500);
      }
      await search(value, { groupBy: { properties: ['group'], maxResult: 5 } });
    },
    [search, ga],
  );

  const highlightedResultRef = React.useRef<SearchResult | undefined>(undefined);

  const handleItemClick = React.useCallback(() => {
    selectedResultRef.current = highlightedResultRef.current ?? null;
    handleCloseDialog(false);
  }, [handleCloseDialog]);

  const handleItemHighlighted = React.useCallback((item: SearchResult | undefined) => {
    highlightedResultRef.current = item;
  }, []);

  const handleKeyDownCapture = React.useCallback(
    (event: React.KeyboardEvent) => {
      // Only handle Enter with modifiers
      if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey && !event.altKey)) {
        return;
      }

      const highlightedResult = highlightedResultRef.current;
      if (!highlightedResult) {
        return;
      }

      // Prevent the Input/List handlers from processing this
      event.preventDefault();
      event.stopPropagation();

      // Open in new tab
      const url = buildResultUrl(highlightedResult);
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [buildResultUrl],
  );

  // Memoized search input component
  const searchInput = React.useMemo(
    () => (
      <div className="SearchInputRoot">
        <MagnifyingGlassIcon className="SearchInputIcon" />
        <Autocomplete.Input
          id="search-input"
          ref={inputRef}
          placeholder="Search"
          className="SearchInput"
          onKeyDownCapture={handleKeyDownCapture}
        />
      </div>
    ),
    [handleKeyDownCapture],
  );

  // Memoized callback for itemToStringValue
  const itemToStringValue = React.useCallback(
    (item: SearchResult | null) => (item ? item.title || item.slug : ''),
    [],
  );

  // Memoized render function for result groups
  const renderResultsList = React.useCallback(
    (group: SearchResults[number]) => (
      <Autocomplete.Group key={group.group} items={group.items} className="SearchGroup">
        {group.group !== 'Default' && (
          <Autocomplete.GroupLabel id={`search-group-${group.group}`} className="SearchGroupLabel">
            {normalizeGroup(group.group)}
          </Autocomplete.GroupLabel>
        )}
        <Autocomplete.Collection>
          {(result: SearchResult, i) => (
            <Autocomplete.Item
              key={result.id || i}
              value={result}
              render={
                <Link href={buildResultUrl(result)} onNavigate={handleItemClick} tabIndex={-1} />
              }
              className="SearchOptionItem"
            >
              <SearchItem result={result} />
            </Autocomplete.Item>
          )}
        </Autocomplete.Collection>
      </Autocomplete.Group>
    ),
    [buildResultUrl, handleItemClick],
  );

  return (
    <Dialog.Root handle={handle} open={dialogOpen} onOpenChange={handleCloseDialog}>
      <Dialog.Portal>
        <Dialog.Backdrop className="SearchBackdrop" />
        {containedScroll ? (
          <Dialog.Viewport className="SearchViewportContained">
            <Dialog.Popup
              ref={popupRef}
              initialFocus={inputRef}
              data-open={dialogOpen}
              className="SearchPopupContained"
            >
              <Autocomplete.Root
                items={searchResults.results}
                onValueChange={handleValueChange}
                onOpenChange={handleAutocompleteEscape}
                onItemHighlighted={handleItemHighlighted}
                open
                inline
                itemToStringValue={itemToStringValue}
                filter={null}
                autoHighlight="always"
                keepHighlight
              >
                <div className="SearchHeadContained">{searchInput}</div>
                <div className="SearchBody">
                  <ScrollArea.Root className="SearchScrollAreaRoot">
                    <ScrollArea.Viewport className="SearchScrollAreaViewport">
                      <ScrollArea.Content style={{ minWidth: '100%' }}>
                        {searchResults.results.length === 0 ? (
                          <EmptyState />
                        ) : (
                          <Autocomplete.List
                            className="SearchList"
                            onKeyDownCapture={handleKeyDownCapture}
                          >
                            {renderResultsList}
                          </Autocomplete.List>
                        )}
                      </ScrollArea.Content>
                    </ScrollArea.Viewport>
                    <ScrollArea.Scrollbar className="SearchScrollbar ">
                      <ScrollArea.Thumb className="SearchScrollbarThumb" />
                    </ScrollArea.Scrollbar>
                  </ScrollArea.Root>
                </div>
                <div className="SearchFooter">
                  <div className="SearchFooterHint">
                    <kbd aria-label="Enter" className="SearchFooterEnter">
                      <CornerDownLeft size={12} />
                    </kbd>
                    <span>Go to page</span>
                  </div>
                </div>
              </Autocomplete.Root>
              <Dialog.Close className="SearchClose">Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Viewport>
        ) : (
          <Dialog.Viewport className="SearchViewportDefault">
            <ScrollArea.Root style={{ position: undefined }} className="SearchRootScrollable">
              <ScrollArea.Viewport className="SearchRootScrollable">
                <ScrollArea.Content className="SearchContentWrap">
                  <Dialog.Popup
                    ref={popupRef}
                    initialFocus={inputRef}
                    data-open={dialogOpen}
                    className="SearchPopupDefault"
                  >
                    <Autocomplete.Root
                      items={searchResults.results}
                      onValueChange={handleValueChange}
                      onOpenChange={handleAutocompleteEscape}
                      onItemHighlighted={handleItemHighlighted}
                      open
                      inline
                      itemToStringValue={itemToStringValue}
                      filter={null}
                      autoHighlight
                    >
                      <div className="SearchHeadDefault">{searchInput}</div>
                      <div>
                        {searchResults.results.length === 0 ? (
                          <EmptyState />
                        ) : (
                          <Autocomplete.List
                            className="SearchListDefault"
                            onKeyDownCapture={handleKeyDownCapture}
                          >
                            {renderResultsList}
                          </Autocomplete.List>
                        )}
                      </div>
                    </Autocomplete.Root>
                    <Dialog.Close className="SearchClose">Close</Dialog.Close>
                  </Dialog.Popup>
                </ScrollArea.Content>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar className="SearchScrollbar ">
                <ScrollArea.Thumb className="SearchScrollbarThumb" />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </Dialog.Viewport>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
