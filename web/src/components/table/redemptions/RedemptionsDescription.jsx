import React from 'react';
import { Typography } from '@douyinfe/semi-ui';
import { Ticket } from 'lucide-react';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const { Text } = Typography;

const RedemptionsDescription = ({ compactMode, setCompactMode, t }) => {
  return (
    <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
      <div className='flex items-center text-orange-500'>
        <Ticket size={16} className='mr-2' />
        <Text>{t('兑换码管理')}</Text>
      </div>

      <CompactModeToggle
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        t={t}
      />
    </div>
  );
};

export default RedemptionsDescription;
