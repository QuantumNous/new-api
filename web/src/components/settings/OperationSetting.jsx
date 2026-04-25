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

import React, { useEffect, useState } from 'react';
import { Card, Spinner } from '@heroui/react';
import SettingsGeneral from '../../pages/Setting/Operation/SettingsGeneral';
import SettingsHeaderNavModules from '../../pages/Setting/Operation/SettingsHeaderNavModules';
import SettingsSidebarModulesAdmin from '../../pages/Setting/Operation/SettingsSidebarModulesAdmin';
import SettingsSensitiveWords from '../../pages/Setting/Operation/SettingsSensitiveWords';
import SettingsLog from '../../pages/Setting/Operation/SettingsLog';
import SettingsMonitoring from '../../pages/Setting/Operation/SettingsMonitoring';
import SettingsCreditLimit from '../../pages/Setting/Operation/SettingsCreditLimit';
import SettingsCheckin from '../../pages/Setting/Operation/SettingsCheckin';
import { API, showError, toBoolean } from '../../helpers';

const OperationSetting = () => {
  let [inputs, setInputs] = useState({
    /* 额度相关 */
    QuotaForNewUser: 0,
    PreConsumedQuota: 0,
    QuotaForInviter: 0,
    QuotaForInvitee: 0,
    'quota_setting.enable_free_model_pre_consume': true,

    /* 通用设置 */
    TopUpLink: '',
    'general_setting.docs_link': '',
    QuotaPerUnit: 0,
    USDExchangeRate: 0,
    RetryTimes: 0,
    'general_setting.quota_display_type': 'USD',
    DisplayTokenStatEnabled: false,
    DefaultCollapseSidebar: false,
    DemoSiteEnabled: false,
    SelfUseModeEnabled: false,

    /* 顶栏模块管理 */
    HeaderNavModules: '',

    /* 左侧边栏模块管理（管理员） */
    SidebarModulesAdmin: '',

    /* 敏感词设置 */
    CheckSensitiveEnabled: false,
    CheckSensitiveOnPromptEnabled: false,
    SensitiveWords: '',

    /* 日志设置 */
    LogConsumeEnabled: false,

    /* 监控设置 */
    ChannelDisableThreshold: 0,
    QuotaRemindThreshold: 0,
    AutomaticDisableChannelEnabled: false,
    AutomaticEnableChannelEnabled: false,
    AutomaticDisableKeywords: '',
    AutomaticDisableStatusCodes: '401',
    AutomaticRetryStatusCodes:
      '100-199,300-399,401-407,409-499,500-503,505-523,525-599',
    'monitor_setting.auto_test_channel_enabled': false,
    'monitor_setting.auto_test_channel_minutes': 10 /* 签到设置 */,
    'checkin_setting.enabled': false,
    'checkin_setting.min_quota': 1000,
    'checkin_setting.max_quota': 10000,

    /* 令牌设置 */
    'token_setting.max_user_tokens': 1000,
  });

  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (typeof inputs[item.key] === 'boolean') {
          newInputs[item.key] = toBoolean(item.value);
        } else {
          newInputs[item.key] = item.value;
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
      // showSuccess('刷新成功');
    } catch (error) {
      showError('刷新失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    onRefresh();
  }, []);

  return (
    <div className='relative'>
      {loading ? (
        <div className='absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/70 backdrop-blur-sm'>
          <Spinner size='lg' />
        </div>
      ) : null}
      {/* General settings */}
      <Card className='mt-2.5'>
        <SettingsGeneral options={inputs} refresh={onRefresh} />
      </Card>
      {/* Header navigation modules */}
      <div className='mt-2.5'>
        <SettingsHeaderNavModules options={inputs} refresh={onRefresh} />
      </div>
      {/* Admin sidebar modules */}
      <div className='mt-2.5'>
        <SettingsSidebarModulesAdmin options={inputs} refresh={onRefresh} />
      </div>
      {/* Sensitive words filter settings */}
      <Card className='mt-2.5'>
        <SettingsSensitiveWords options={inputs} refresh={onRefresh} />
      </Card>
      {/* Log settings */}
      <Card className='mt-2.5'>
        <SettingsLog options={inputs} refresh={onRefresh} />
      </Card>
      {/* Monitoring settings */}
      <Card className='mt-2.5'>
        <SettingsMonitoring options={inputs} refresh={onRefresh} />
      </Card>
      {/* Credit settings */}
      <Card className='mt-2.5'>
        <SettingsCreditLimit options={inputs} refresh={onRefresh} />
      </Card>
      {/* Checkin settings */}
      <Card className='mt-2.5'>
        <SettingsCheckin options={inputs} refresh={onRefresh} />
      </Card>
    </div>
  );
};

export default OperationSetting;
