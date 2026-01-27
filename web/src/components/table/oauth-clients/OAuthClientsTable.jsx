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

import React, { useMemo } from 'react';
import { Empty } from '@douyinfe/semi-ui';
import CardTable from '../../common/ui/CardTable';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getOAuthClientsColumns } from './OAuthClientsColumnDefs';

const OAuthClientsTable = (clientsData) => {
  const {
    clients,
    loading,
    activePage,
    pageSize,
    clientCount,
    handlePageChange,
    handlePageSizeChange,
    rowSelection,
    copyText,
    deleteClient,
    setEditingClient,
    setShowEdit,
    refresh,
    t,
  } = clientsData;

  // Get all columns
  const columns = useMemo(() => {
    return getOAuthClientsColumns({
      t,
      copyText,
      deleteClient,
      setEditingClient,
      setShowEdit,
      refresh,
    });
  }, [t, copyText, deleteClient, setEditingClient, setShowEdit, refresh]);

  return (
    <CardTable
      columns={columns}
      dataSource={clients}
      scroll={{ x: 'max-content' }}
      pagination={{
        currentPage: activePage,
        pageSize: pageSize,
        total: clientCount,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50, 100],
        onPageSizeChange: handlePageSizeChange,
        onPageChange: handlePageChange,
      }}
      hidePagination={true}
      loading={loading}
      rowSelection={rowSelection}
      rowKey='client_id'
      empty={
        <Empty
          image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
          darkModeImage={
            <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
          }
          description={t('暂无数据')}
          style={{ padding: 30 }}
        />
      }
      className='rounded-xl overflow-hidden'
      size='middle'
    />
  );
};

export default OAuthClientsTable;
