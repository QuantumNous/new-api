import React from 'react';
import { Tabs } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import TransferTab from './TransferTab';
import InvoiceTab from './InvoiceTab';
import { useReviewPendingCounts } from '../../hooks/common/useReviewPendingCounts';

// 页签文字右侧的待审核红圈（0 时不显示），与侧边栏红点同款样式。
function tabWithBadge(label, count) {
  if (!count) return label;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {label}
      <span
        style={{
          minWidth: 16,
          height: 16,
          padding: '0 4px',
          borderRadius: 8,
          background: 'var(--semi-color-danger)',
          color: '#fff',
          fontSize: 11,
          lineHeight: '16px',
          textAlign: 'center',
        }}
      >
        {count > 99 ? '99+' : count}
      </span>
    </span>
  );
}

// 对公转账 + 发票审核共用一个菜单入口（设计文档 D4：同页双页签）。
export default function BankTransferPage() {
  const { t } = useTranslation();
  const counts = useReviewPendingCounts();
  return (
    <div className='mt-[60px] px-2'>
      <Tabs type='line' defaultActiveKey='transfer'>
        <Tabs.TabPane
          tab={tabWithBadge(t('转账审核'), counts.bank_transfer)}
          itemKey='transfer'
        >
          <TransferTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={tabWithBadge(t('发票审核'), counts.invoice)}
          itemKey='invoice'
        >
          <InvoiceTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
