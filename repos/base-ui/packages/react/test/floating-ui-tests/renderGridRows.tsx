import * as React from 'react';

export const GRID_COLUMN_COUNT = 2;

export function renderGridRows(children: React.ReactNode, grid?: boolean) {
  if (!grid) {
    return children;
  }

  const items = React.Children.toArray(children);

  return Array.from({ length: Math.ceil(items.length / GRID_COLUMN_COUNT) }, (_row, rowIndex) => (
    <div key={rowIndex} role="row" style={{ display: 'contents' }}>
      {items.slice(rowIndex * GRID_COLUMN_COUNT, rowIndex * GRID_COLUMN_COUNT + GRID_COLUMN_COUNT)}
    </div>
  ));
}
