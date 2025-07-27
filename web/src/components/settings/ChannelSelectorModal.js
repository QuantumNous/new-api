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

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useIsMobile } from '../../hooks/common/useIsMobile.js';
import {
  Modal,
  Table,
  Input,
  Space,
  Highlight,
  Select,
  Tag,
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { CheckCircle, XCircle, AlertCircle, HelpCircle } from 'lucide-react';

const ChannelSelectorModal = forwardRef(({
  visible,
  onCancel,
  onOk,
  allChannels,
  selectedChannelIds,
  setSelectedChannelIds,
  channelEndpoints,
  updateChannelEndpoint,
  t,
}, ref) => {
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const isMobile = useIsMobile();

  const [filteredData, setFilteredData] = useState([]);

  useImperativeHandle(ref, () => ({
    resetPagination: () => {
      setCurrentPage(1);
      setSearchText('');
    },
  }));

  useEffect(() => {
    if (!allChannels) return;

    const searchLower = searchText.trim().toLowerCase();
    const matched = searchLower
      ? allChannels.filter((item) => {
        const name = (item.label || '').toLowerCase();
        const baseUrl = (item._originalData?.base_url || '').toLowerCase();
        return name.includes(searchLower) || baseUrl.includes(searchLower);
      })
      : allChannels;

    setFilteredData(matched);
  }, [allChannels, searchText]);

  const total = filteredData.length;

  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const updateEndpoint = (channelId, endpoint) => {
    if (typeof updateChannelEndpoint === 'function') {
      updateChannelEndpoint(channelId, endpoint);
    }
  };

  const renderEndpointCell = (text, record) => {
    const channelId = record.key || record.value;
    const currentEndpoint = channelEndpoints[channelId] || '';

    const getEndpointType = (ep) => {
      if (ep === '/api/ratio_config') return 'ratio_config';
      if (ep === '/api/pricing') return 'pricing';
      return 'custom';
    };

    const currentType = getEndpointType(currentEndpoint);

    const handleTypeChange = (val) => {
      if (val === 'ratio_config') {
        updateEndpoint(channelId, '/api/ratio_config');
      } else if (val === 'pricing') {
        updateEndpoint(channelId, '/api/pricing');
      } else {
        if (currentType !== 'custom') {
          updateEndpoint(channelId, '');
        }
      }
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Select
          size="small"
          value={currentType}
          onChange={handleTypeChange}
          style={{ width: 120 }}
          optionList={[
            { label: 'ratio_config', value: 'ratio_config' },
            { label: 'pricing', value: 'pricing' },
            { label: 'custom', value: 'custom' },
          ]}
        />
        {currentType === 'custom' && (
          <Input
            size="small"
            value={currentEndpoint}
            onChange={(val) => updateEndpoint(channelId, val)}
            placeholder="/your/endpoint"
            style={{ width: 160, fontSize: 12 }}
          />
        )}
      </div>
    );
  };

  const renderStatusCell = (status) => {
    switch (status) {
      case 1:
        return (
          <Tag color='green' shape='circle' prefixIcon={<CheckCircle size={14} />}>
            {t('已启用')}
          </Tag>
        );
      case 2:
        return (
          <Tag color='red' shape='circle' prefixIcon={<XCircle size={14} />}>
            {t('已禁用')}
          </Tag>
        );
      case 3:
        return (
          <Tag color='yellow' shape='circle' prefixIcon={<AlertCircle size={14} />}>
            {t('自动禁用')}
          </Tag>
        );
      default:
        return (
          <Tag color='grey' shape='circle' prefixIcon={<HelpCircle size={14} />}>
            {t('未知状态')}
          </Tag>
        );
    }
  };

  const renderNameCell = (text) => (
    <Highlight sourceString={text} searchWords={[searchText]} />
  );

  const renderBaseUrlCell = (text) => (
    <Highlight sourceString={text} searchWords={[searchText]} />
  );

  const columns = [
    {
      title: t('名称'),
      dataIndex: 'label',
      render: renderNameCell,
    },
    {
      title: t('源地址'),
      dataIndex: '_originalData.base_url',
      render: (_, record) => renderBaseUrlCell(record._originalData?.base_url || ''),
    },
    {
      title: t('状态'),
      dataIndex: '_originalData.status',
      render: (_, record) => renderStatusCell(record._originalData?.status || 0),
    },
    {
      title: t('同步接口'),
      dataIndex: 'endpoint',
      fixed: 'right',
      render: renderEndpointCell,
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectedChannelIds,
    onChange: (keys) => setSelectedChannelIds(keys),
  };

  return (
    <Modal
      visible={visible}
      onCancel={onCancel}
      onOk={onOk}
      title={<span className="text-lg font-semibold">{t('选择同步渠道')}</span>}
      size={isMobile ? 'full-width' : 'large'}
      keepDOM
      lazyRender={false}
    >
      <Space vertical style={{ width: '100%' }}>
        <Input
          prefix={<IconSearch size={14} />}
          placeholder={t('搜索渠道名称或地址')}
          value={searchText}
          onChange={setSearchText}
          showClear
        />

        <Table
          columns={columns}
          dataSource={paginatedData}
          rowKey="key"
          rowSelection={rowSelection}
          pagination={{
            currentPage: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
            onShowSizeChange: (curr, size) => {
              setCurrentPage(1);
              setPageSize(size);
            },
          }}
          size="small"
        />
      </Space>
    </Modal>
  );
});

export default ChannelSelectorModal; 