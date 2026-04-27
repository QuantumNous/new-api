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
import { useTranslation } from 'react-i18next';
import { SearchX } from 'lucide-react';

const NotFound = () => {
  const { t } = useTranslation();
  return (
    <div className='flex justify-center items-center h-screen p-8'>
      <div className='glass-panel flex max-w-md flex-col items-center gap-4 rounded-[2rem] p-8 text-center'>
        <div className='flex h-24 w-24 items-center justify-center rounded-[2rem] bg-warning/10 text-warning'>
          <SearchX size={44} />
        </div>
        <h1 className='text-2xl font-bold text-foreground'>404</h1>
        <p className='text-sm text-muted'>
          {t('页面未找到，请检查您的浏览器地址是否正确')}
        </p>
      </div>
    </div>
  );
};

export default NotFound;
