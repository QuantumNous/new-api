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

const ParamOverrideEntry = ({ count, onOpen, t }) => {
  return (
    <div className='flex flex-wrap items-center gap-2.5'>
      <span className='text-xs tabular-nums text-muted'>
        {t('{{count}} 项操作', { count })}
      </span>
      <button
        type='button'
        className='text-xs font-semibold text-accent transition hover:text-accent/80'
        onClick={onOpen}
      >
        {t('查看详情')}
      </button>
    </div>
  );
};

export default React.memo(ParamOverrideEntry);
