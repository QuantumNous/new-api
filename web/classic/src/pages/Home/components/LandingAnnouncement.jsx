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
import { Button, Tag, Typography } from '@douyinfe/semi-ui';
import { IconArrowRight } from '@douyinfe/semi-icons';

const { Text } = Typography;

const LandingAnnouncement = ({ announcement, docsLink }) => {
  if (!announcement) return null;

  return (
    <div className='mx-auto flex w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8'>
      <div className='flex w-full flex-col items-start gap-3 rounded-2xl border border-semi-color-border bg-semi-color-bg-1 px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between'>
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
          <Tag color='blue' shape='circle'>
            {announcement.label}
          </Tag>
          <Text className='!text-sm !text-semi-color-text-1'>
            {announcement.text}
          </Text>
        </div>
        {docsLink && (
          <Button
            size='small'
            theme='borderless'
            type='primary'
            icon={<IconArrowRight />}
            iconPosition='right'
            onClick={() => window.open(docsLink, '_blank')}
          >
            {announcement.actionText}
          </Button>
        )}
      </div>
    </div>
  );
};

export default LandingAnnouncement;
