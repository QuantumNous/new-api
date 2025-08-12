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
import { Tabs, TabPane, Tag, Button, Dropdown, Modal } from '@douyinfe/semi-ui';
import { IconEdit, IconDelete } from '@douyinfe/semi-icons';
import { getLobeHubIcon, showError, showSuccess } from '../../../helpers';
import { API } from '../../../helpers';

const ModelsTabs = ({
  activeVendorKey,
  setActiveVendorKey,
  vendorCounts,
  vendors,
  loadModels,
  activePage,
  pageSize,
  setActivePage,
  setShowAddVendor,
  setShowEditVendor,
  setEditingVendor,
  loadVendors,
  t
}) => {
  const handleTabChange = (key) => {
    setActiveVendorKey(key);
    setActivePage(1);
    loadModels(1, pageSize, key);
  };

  const handleEditVendor = (vendor, e) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发tab切换
    setEditingVendor(vendor);
    setShowEditVendor(true);
  };

  const handleDeleteVendor = async (vendor, e) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发tab切换
    try {
      const res = await API.delete(`/api/vendors/${vendor.id}`);
      if (res.data.success) {
        showSuccess(t('供应商删除成功'));
        // 如果删除的是当前选中的供应商，切换到"全部"
        if (activeVendorKey === String(vendor.id)) {
          setActiveVendorKey('all');
          loadModels(1, pageSize, 'all');
        } else {
          loadModels(activePage, pageSize, activeVendorKey);
        }
        loadVendors(); // 重新加载供应商列表
      } else {
        showError(res.data.message || t('删除失败'));
      }
    } catch (error) {
      showError(error.response?.data?.message || t('删除失败'));
    }
  };

  return (
    <Tabs
      activeKey={activeVendorKey}
      type="card"
      collapsible
      onChange={handleTabChange}
      className="mb-2"
      tabBarExtraContent={
        <Button
          type="primary"
          size="small"
          onClick={() => setShowAddVendor(true)}
        >
          {t('新增供应商')}
        </Button>
      }
    >
      <TabPane
        itemKey="all"
        tab={
          <span className="flex items-center gap-2">
            {t('全部')}
            <Tag color={activeVendorKey === 'all' ? 'red' : 'grey'} shape='circle'>
              {vendorCounts['all'] || 0}
            </Tag>
          </span>
        }
      />

      {vendors.map((vendor) => {
        const key = String(vendor.id);
        const count = vendorCounts[vendor.id] || 0;
        return (
          <TabPane
            key={key}
            itemKey={key}
            tab={
              <span className="flex items-center gap-2">
                {getLobeHubIcon(vendor.icon || 'Layers', 14)}
                {vendor.name}
                <Tag color={activeVendorKey === key ? 'red' : 'grey'} shape='circle'>
                  {count}
                </Tag>
                <Dropdown
                  trigger="click"
                  position="bottomRight"
                  render={
                    <Dropdown.Menu>
                      <Dropdown.Item
                        icon={<IconEdit />}
                        onClick={(e) => handleEditVendor(vendor, e)}
                      >
                        {t('编辑')}
                      </Dropdown.Item>
                      <Dropdown.Item
                        type="danger"
                        icon={<IconDelete />}
                        onClick={(e) => {
                          e.stopPropagation();
                          Modal.confirm({
                            title: t('确认删除'),
                            content: t('确定要删除供应商 "{{name}}" 吗？此操作不可撤销。', { name: vendor.name }),
                            onOk: () => handleDeleteVendor(vendor, e),
                            okText: t('删除'),
                            cancelText: t('取消'),
                            type: 'warning',
                            okType: 'danger',
                          });
                        }}
                      >
                        {t('删除')}
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  }
                  onClickOutSide={(e) => e.stopPropagation()}
                >
                  <Button
                    size="small"
                    type="tertiary"
                    theme="outline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('操作')}
                  </Button>
                </Dropdown>
              </span>
            }
          />
        );
      })}
    </Tabs>
  );
};

export default ModelsTabs;