import React from 'react';
import { Card } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import TopupHistoryModal from '../../components/topup/modals/TopupHistoryModal';

const Invoice = () => {
  const { t } = useTranslation();

  return (
    <div className='w-full max-w-7xl mx-auto mt-[60px] px-2'>
      <Card title={t('充值账单')}>
        <TopupHistoryModal asPage t={t} />
      </Card>
    </div>
  );
};

export default Invoice;
