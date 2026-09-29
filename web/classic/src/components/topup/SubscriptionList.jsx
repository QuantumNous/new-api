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

import React, { useId, useState } from 'react';
import { Button, Collapsible, Divider, Pagination } from '@douyinfe/semi-ui';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getSubscriptionHistoryPage } from '../../helpers/subscriptionDisplay';

export default function SubscriptionList({
  current,
  history,
  renderSubscription,
}) {
  const { t } = useTranslation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [page, setPage] = useState(1);
  const historyId = useId();
  const historyPage = getSubscriptionHistoryPage(history, page);

  const renderRecords = (records) =>
    records.map((record, index) => (
      <React.Fragment key={record.subscription.id}>
        {renderSubscription(record)}
        {index < records.length - 1 && <Divider margin={12} />}
      </React.Fragment>
    ));

  return (
    <div className='space-y-3'>
      {current.length > 0 ? (
        renderRecords(current)
      ) : (
        <div className='text-xs text-gray-500'>{t('暂无当前订阅')}</div>
      )}
      {history.length > 0 && (
        <div>
          <Button
            theme='borderless'
            type='tertiary'
            size='small'
            block
            aria-expanded={historyOpen}
            aria-controls={historyId}
            onClick={() => {
              setHistoryOpen(!historyOpen);
              if (!historyOpen) setPage(1);
            }}
          >
            {t('历史订阅')} ({history.length})
            <ChevronDown
              size={14}
              className={historyOpen ? 'rotate-180' : ''}
            />
          </Button>
          <Collapsible
            isOpen={historyOpen}
            keepDOM={false}
            reCalcKey={historyPage.page}
          >
            {historyOpen && (
              <div id={historyId} className='space-y-3 pt-3'>
                {renderRecords(historyPage.items)}
                {historyPage.totalPages > 1 && (
                  <Pagination
                    size='small'
                    currentPage={historyPage.page}
                    pageSize={10}
                    total={history.length}
                    onPageChange={setPage}
                  />
                )}
              </div>
            )}
          </Collapsible>
        </div>
      )}
    </div>
  );
}
