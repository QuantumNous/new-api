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
import { Card, Spinner } from '@heroui/react';
import { API, showError, showSuccess, toBoolean } from '../../helpers';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';
import SettingsAPIInfo from '../../pages/Setting/Dashboard/SettingsAPIInfo';
import SettingsAnnouncements from '../../pages/Setting/Dashboard/SettingsAnnouncements';
import SettingsFAQ from '../../pages/Setting/Dashboard/SettingsFAQ';
import SettingsUptimeKuma from '../../pages/Setting/Dashboard/SettingsUptimeKuma';
import SettingsDataDashboard from '../../pages/Setting/Dashboard/SettingsDataDashboard';

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
  const [showMigrateModal, setShowMigrateModal] = useState(false); // Remove in the next release.

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.key in inputs) {
          newInputs[item.key] = item.value;
        }
        if (item.key.endsWith('Enabled') && item.key === 'DataExportEnabled') {
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

  // Legacy keys used for migration detection. Remove in the next release.
  const hasLegacyData = useMemo(() => {
    const legacyKeys = [
      'ApiInfo',
      'Announcements',
      'FAQ',
      'UptimeKumaUrl',
      'UptimeKumaSlug',
    ];
    return legacyKeys.some((k) => inputs[k]);
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
    <div className='relative'>
      {loading ? (
        <div className='absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/70 backdrop-blur-sm'>
          <Spinner size='lg' />
        </div>
      ) : null}
      <ConfirmDialog
        visible={showMigrateModal}
        title='配置迁移确认'
        confirmText='确认迁移'
        cancelText='取消'
        onConfirm={handleMigrate}
        onCancel={() => setShowMigrateModal(false)}
      >
        <p>检测到旧版本的配置数据，是否要迁移到新的配置格式？</p>
        <p className='mt-2.5 text-warning'>
          <strong>注意：</strong>
          迁移过程中会自动处理数据格式转换，迁移完成后旧配置将被清除，请在迁移前在数据库中备份好旧配置。
        </p>
      </ConfirmDialog>

      {/* Data dashboard settings */}
      <Card className='mt-2.5'>
        <SettingsDataDashboard options={inputs} refresh={onRefresh} />
      </Card>

      {/* System announcement management */}
      <Card className='mt-2.5'>
        <SettingsAnnouncements options={inputs} refresh={onRefresh} />
      </Card>

      {/* API info management */}
      <Card className='mt-2.5'>
        <SettingsAPIInfo options={inputs} refresh={onRefresh} />
      </Card>

      {/* FAQ management */}
      <Card className='mt-2.5'>
        <SettingsFAQ options={inputs} refresh={onRefresh} />
      </Card>

      {/* Uptime Kuma monitoring settings */}
      <Card className='mt-2.5'>
        <SettingsUptimeKuma options={inputs} refresh={onRefresh} />
      </Card>
    </div>
  );
};

export default DashboardSetting;
