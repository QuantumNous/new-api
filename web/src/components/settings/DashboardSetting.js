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

import React, { useEffect, useState, useMemo } from 'react';
import { Card, Spin, Button, Modal } from '@douyinfe/semi-ui';
import { API, showError, showSuccess, toBoolean } from '../../helpers';
import SettingsAPIInfo from '../../pages/Setting/Dashboard/SettingsAPIInfo.js';
import SettingsAnnouncements from '../../pages/Setting/Dashboard/SettingsAnnouncements.js';
import SettingsFAQ from '../../pages/Setting/Dashboard/SettingsFAQ.js';
import SettingsUptimeKuma from '../../pages/Setting/Dashboard/SettingsUptimeKuma.js';
import SettingsDataDashboard from '../../pages/Setting/Dashboard/SettingsDataDashboard.js';

const DashboardSetting = () => {
  let [inputs, setInputs] = useState({
    'console_setting.api_info': '',
    'console_setting.announcements': '',
    'console_setting.faq': '',
    'console_setting.uptime_kuma_groups': '',
    'console_setting.api_info_enabled': '',
    'console_setting.announcements_enabled': '',
    'console_setting.faq_enabled': '',
    'console_setting.uptime_kuma_enabled': '',

    // 用于迁移检测的旧键，下个版本会删除
    ApiInfo: '',
    Announcements: '',
    FAQ: '',
    UptimeKumaUrl: '',
    UptimeKumaSlug: '',

    /* 数据看板 */
    DataExportEnabled: false,
    DataExportDefaultTime: 'hour',
    DataExportInterval: 5,
  });

  let [loading, setLoading] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false); // 下个版本会删除

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.key in inputs) {
          newInputs[item.key] = item.value;
        }
        if (item.key.endsWith('Enabled') &&
          (item.key === 'DataExportEnabled')) {
          newInputs[item.key] = toBoolean(item.value);
        }
      });
      setInputs(newInputs);
    } else {
      showError(message);
    }
  };

  async function onRefresh() {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError('刷新失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    onRefresh();
  }, []);

  // 用于迁移检测的旧键，下个版本会删除
  const hasLegacyData = useMemo(() => {
    const legacyKeys = ['ApiInfo', 'Announcements', 'FAQ', 'UptimeKumaUrl', 'UptimeKumaSlug'];
    return legacyKeys.some(k => inputs[k]);
  }, [inputs]);

  useEffect(() => {
    if (hasLegacyData) {
      setShowMigrateModal(true);
    }
  }, [hasLegacyData]);

  const handleMigrate = async () => {
    try {
      setLoading(true);
      await API.post('/api/option/migrate_console_setting');
      showSuccess('旧配置迁移完成');
      await onRefresh();
      setShowMigrateModal(false);
    } catch (err) {
      console.error(err);
      showError('迁移失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Spin spinning={loading} size='large'>
        {/* 用于迁移检测的旧键模态框，下个版本会删除 */}
        <Modal
          title="配置迁移确认"
          visible={showMigrateModal}
          onOk={handleMigrate}
          onCancel={() => setShowMigrateModal(false)}
          confirmLoading={loading}
          okText="确认迁移"
          cancelText="取消"
        >
          <p>检测到旧版本的配置数据，是否要迁移到新的配置格式？</p>
          <p style={{ color: '#f57c00', marginTop: '10px' }}>
            <strong>注意：</strong>迁移过程中会自动处理数据格式转换，迁移完成后旧配置将被清除，请在迁移前在数据库中备份好旧配置。
          </p>
        </Modal>

        {/* 数据看板设置 */}
        <Card style={{ marginTop: '10px' }}>
          <SettingsDataDashboard options={inputs} refresh={onRefresh} />
        </Card>

        {/* 系统公告管理 */}
        <Card style={{ marginTop: '10px' }}>
          <SettingsAnnouncements options={inputs} refresh={onRefresh} />
        </Card>

        {/* API信息管理 */}
        <Card style={{ marginTop: '10px' }}>
          <SettingsAPIInfo options={inputs} refresh={onRefresh} />
        </Card>

        {/* 常见问答管理 */}
        <Card style={{ marginTop: '10px' }}>
          <SettingsFAQ options={inputs} refresh={onRefresh} />
        </Card>

        {/* Uptime Kuma 监控设置 */}
        <Card style={{ marginTop: '10px' }}>
          <SettingsUptimeKuma options={inputs} refresh={onRefresh} />
        </Card>
      </Spin>
    </>
  );
};

export default DashboardSetting; 