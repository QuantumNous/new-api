'use client';
import * as React from 'react';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { matchSorter } from 'match-sorter';

export default function ExampleFuzzyMatchingAutocomplete() {
  return (
    <Autocomplete.Root
      items={fuzzyItems}
      filter={fuzzyFilter}
      itemToStringValue={(item) => item.title}
    >
      <label className="flex flex-col gap-1 text-sm font-bold text-neutral-950 dark:text-white">
        Fuzzy search documentation
        <Autocomplete.Input
          placeholder="e.g. React"
          className="h-8 w-[16rem] border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
        />
      </label>

      <Autocomplete.Portal>
        <Autocomplete.Positioner className="outline-hidden" sideOffset={4}>
          <Autocomplete.Popup className="w-(--anchor-width) max-w-(--available-width) border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
            <Autocomplete.Empty>
              <div className="py-3 pr-4 pl-2 text-sm leading-4 text-neutral-500 dark:text-neutral-400">
                No results found for "{<Autocomplete.Value />}"
              </div>
            </Autocomplete.Empty>

            <Autocomplete.List className="flex max-h-[min(var(--available-height),28rem)] flex-col overflow-y-auto overscroll-contain py-1 scroll-pt-1 scroll-pb-1 empty:p-0">
              {(item: FuzzyItem) => (
                <Autocomplete.Item
                  key={item.title}
                  value={item}
                  className="flex cursor-default py-3 pr-2 pl-2 text-sm leading-6 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:before:absolute data-highlighted:before:inset-x-0 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-100 dark:data-highlighted:before:bg-neutral-800"
                >
                  <Autocomplete.Value>
                    {(value) => (
                      <span className="flex w-full flex-col gap-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="flex-1 font-bold leading-5">
                            {highlightText(item.title, value)}
                          </span>
                        </span>
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">
                          {highlightText(item.description, value)}
                        </span>
                      </span>
                    )}
                  </Autocomplete.Value>
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

function highlightText(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) {
    return text;
  }

  const limited = trimmed.slice(0, 100);
  const escaped = limited.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');

  return text.split(regex).map((part, idx) =>
    regex.test(part) ? (
      <mark key={idx} className="bg-transparent font-bold text-blue-800 dark:text-blue-500">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function fuzzyFilter(item: FuzzyItem, query: string): boolean {
  if (!query) {
    return true;
  }

  const results = matchSorter([item], query, {
    keys: [
      'title',
      'description',
      'category',
      { key: 'title', threshold: matchSorter.rankings.CONTAINS },
      { key: 'description', threshold: matchSorter.rankings.WORD_STARTS_WITH },
    ],
  });

  return results.length > 0;
}

interface FuzzyItem {
  title: string;
  description: string;
  category: string;
}

const fuzzyItems: FuzzyItem[] = [
  {
    title: 'React Hooks Guide',
    description: 'Learn how to use React Hooks like useState, useEffect, and custom hooks',
    category: 'React',
  },
  {
    title: 'JavaScript Array Methods',
    description: 'Master array methods like map, filter, reduce, and forEach in JavaScript',
    category: 'JavaScript',
  },
  {
    title: 'CSS Flexbox Layout',
    description: 'Complete guide to CSS Flexbox for responsive web design',
    category: 'CSS',
  },
  {
    title: 'TypeScript Interfaces',
    description: 'Understanding TypeScript interfaces and type definitions',
    category: 'TypeScript',
  },
  {
    title: 'React Performance Optimization',
    description: 'Tips and techniques for optimizing React application performance',
    category: 'React',
  },
  {
    title: 'HTML Semantic Elements',
    description: 'Using semantic HTML elements for better accessibility and SEO',
    category: 'HTML',
  },
  {
    title: 'Node.js Express Server',
    description: 'Building RESTful APIs with Node.js and Express framework',
    category: 'Node.js',
  },
  {
    title: 'Vue Composition API',
    description: 'Modern Vue.js development using the Composition API',
    category: 'Vue.js',
  },
  {
    title: 'Angular Components',
    description: 'Creating reusable Angular components with TypeScript',
    category: 'Angular',
  },
  {
    title: 'Python Django Framework',
    description: 'Web development with Python Django framework',
    category: 'Python',
  },
  {
    title: 'CSS Grid Layout',
    description: 'Advanced CSS Grid techniques for complex layouts',
    category: 'CSS',
  },
  {
    title: 'React Testing Library',
    description: 'Testing React components with React Testing Library',
    category: 'React',
  },
  {
    title: 'MongoDB Queries',
    description: 'Advanced MongoDB queries and aggregation pipelines',
    category: 'Database',
  },
  {
    title: 'Webpack Configuration',
    description: 'Optimizing webpack configuration for production builds',
    category: 'Build Tools',
  },
  {
    title: 'SASS/SCSS Guide',
    description: 'Writing maintainable CSS with SASS and SCSS',
    category: 'CSS',
  },
];
