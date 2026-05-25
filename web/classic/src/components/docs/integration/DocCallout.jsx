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
import { Banner, Typography } from '@douyinfe/semi-ui';

const DocCallout = ({ variant = 'info', title, children, className = '' }) => {
  const type = variant === 'warning' ? 'warning' : 'info';

  return (
    <Banner
      fullMode={false}
      type={type}
      className={className}
      description={
        <div>
          {title ? (
            <Typography.Text strong className='!text-inherit'>
              {title}
            </Typography.Text>
          ) : null}
          <Typography.Text className='!text-inherit mt-1 block leading-relaxed'>
            {children}
          </Typography.Text>
        </div>
      }
    />
  );
};

export default DocCallout;
