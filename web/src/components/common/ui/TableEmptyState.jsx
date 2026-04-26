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

const TableEmptyState = ({ title, description }) => {
  return (
    <div className='flex min-h-48 items-center justify-center px-4 py-8'>
      <div className='flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-secondary/70 px-6 py-8 text-center'>
        <div className='flex h-12 w-12 items-center justify-center rounded-full bg-surface-secondary text-muted'>
          <SearchX size={24} />
        </div>
        {title ? (
          <h3 className='text-sm font-semibold text-foreground'>
            {title}
          </h3>
        ) : null}
        <p className='text-sm text-muted'>{description}</p>
      </div>
    </div>
  );
};

export default TableEmptyState;
