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

import React from 'react';
import { SearchX } from 'lucide-react';
import { Surface } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';

const TableEmptyState = ({ title, description, icon, size = 'sm' }) => {
  return (
    // Wrap the empty state in a HeroUI `Surface` so it gets the same
    // surface bg + foreground tokens as the rest of the table body
    // cards. Without this the empty state floats over the gray
    // `.table-root--primary` container and looks like a hole in the page.
    <Surface
      variant='default'
      className='flex min-h-48 w-full items-center justify-center rounded-2xl px-4 py-8'
    >
      <EmptyState size={size}>
        <EmptyState.Header>
          <EmptyState.Media variant='icon'>
            {icon ?? <SearchX />}
          </EmptyState.Media>
          {title ? <EmptyState.Title>{title}</EmptyState.Title> : null}
          {description ? (
            <EmptyState.Description>{description}</EmptyState.Description>
          ) : null}
        </EmptyState.Header>
      </EmptyState>
    </Surface>
  );
};

export default TableEmptyState;
