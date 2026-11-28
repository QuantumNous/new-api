'use client';
import * as React from 'react';

interface GroupCollectionContext {
  items: readonly any[];
}

const GroupCollectionContext = React.createContext<GroupCollectionContext | null>(null);

export function useGroupCollectionContext() {
  return React.useContext(GroupCollectionContext);
}

export function GroupCollectionProvider(props: GroupCollectionProvider.Props) {
  const { children, items } = props;

  const contextValue = React.useMemo(() => ({ items }), [items]);

  return (
    <GroupCollectionContext.Provider value={contextValue}>
      {children}
    </GroupCollectionContext.Provider>
  );
}

namespace GroupCollectionProvider {
  export interface Props {
    children: React.ReactNode;
    items: readonly any[];
  }
}
