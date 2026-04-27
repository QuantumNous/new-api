/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// Lets a page (e.g. Dashboard) inject content into the single console
// page-header row that PageLayout renders next to <Sidebar.Trigger />.
//
// Without this, every console page would either need its own duplicate
// trigger row, or the trigger would sit alone on a separate row above the
// page's actual title — both ugly. With it, the layout renders one row:
//   [trigger]  [page-supplied title]            [page-supplied actions]
//
// Pages that don't push anything (Channel, User, Token, Log, …) just get a
// trigger-only row, which keeps the visual rhythm consistent across the
// console without touching every page file.
const PageHeaderContext = createContext(null);

export const PageHeaderProvider = ({ children }) => {
  const [content, setContent] = useState({ title: null, actions: null });

  // Stable setter so consumers can pass it directly into useEffect deps
  // without causing re-render loops.
  const setHeaderContent = useCallback((next) => {
    setContent((prev) => {
      const merged = typeof next === 'function' ? next(prev) : next;
      return {
        title: merged?.title ?? null,
        actions: merged?.actions ?? null,
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      title: content.title,
      actions: content.actions,
      setHeaderContent,
    }),
    [content.title, content.actions, setHeaderContent],
  );

  return (
    <PageHeaderContext.Provider value={value}>
      {children}
    </PageHeaderContext.Provider>
  );
};

// Internal — used by PageLayout to read the registered content.
export const usePageHeaderContent = () => {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    return { title: null, actions: null };
  }
  return { title: ctx.title, actions: ctx.actions };
};

// Public hook — pages call this with `{ title, actions }` to populate the
// console page-header row. Pass `null` (or unmount) to clear.
//
// Example:
//   usePageHeader({
//     title: <h2 className='...'>{greeting}</h2>,
//     actions: <RefreshButton />,
//   });
export const usePageHeader = (content) => {
  const ctx = useContext(PageHeaderContext);

  useEffect(() => {
    if (!ctx) return undefined;
    ctx.setHeaderContent(content);
    return () => ctx.setHeaderContent({ title: null, actions: null });
    // We intentionally re-run only when `content` (a memoised object from
    // the caller) changes — pages are responsible for stabilising it via
    // useMemo if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);
};
