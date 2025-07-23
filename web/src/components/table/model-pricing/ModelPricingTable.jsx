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
import { Card, Table, Empty } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark
} from '@douyinfe/semi-illustrations';
import { getModelPricingColumns } from './ModelPricingColumnDefs.js';

const ModelPricingTable = ({
  filteredModels,
  loading,
  rowSelection,
  pageSize,
  setPageSize,
  selectedGroup,
  usableGroup,
  groupRatio,
  copyText,
  setModalImageUrl,
  setIsModalOpenurl,
  currency,
  showWithRecharge,
  tokenUnit,
  setTokenUnit,
  displayPrice,
  filteredValue,
  handleGroupClick,
  t
}) => {
  const columns = useMemo(() => {
    return getModelPricingColumns({
      t,
      selectedGroup,
      usableGroup,
      groupRatio,
      copyText,
      setModalImageUrl,
      setIsModalOpenurl,
      currency,
      showWithRecharge,
      tokenUnit,
      setTokenUnit,
      displayPrice,
      handleGroupClick,
    });
  }, [
    t,
    selectedGroup,
    usableGroup,
    groupRatio,
    copyText,
    setModalImageUrl,
    setIsModalOpenurl,
    currency,
    showWithRecharge,
    tokenUnit,
    setTokenUnit,
    displayPrice,
    handleGroupClick,
  ]);

  // 更新列定义中的 filteredValue
  const tableColumns = useMemo(() => {
    return columns.map(column => {
      if (column.dataIndex === 'model_name') {
        return {
          ...column,
          filteredValue
        };
      }
      return column;
    });
  }, [columns, filteredValue]);

  const ModelTable = useMemo(() => (
    <Card className="!rounded-xl overflow-hidden" bordered={false}>
      <Table
        columns={tableColumns}
        dataSource={filteredModels}
        loading={loading}
        rowSelection={rowSelection}
        className="custom-table"
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={<IllustrationNoResultDark style={{ width: 150, height: 150 }} />}
            description={t('搜索无结果')}
            style={{ padding: 30 }}
          />
        }
        pagination={{
          defaultPageSize: 10,
          pageSize: pageSize,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          onPageSizeChange: (size) => setPageSize(size),
        }}
      />
    </Card>
  ), [filteredModels, loading, tableColumns, rowSelection, pageSize, setPageSize, t]);

  return ModelTable;
};

export default ModelPricingTable; 