import React, { useEffect, useState } from 'react';
import { Card, Spin } from '@douyinfe/semi-ui';
import SettingsGeneral from '../../pages/Setting/Operation/SettingsGeneral.js';
import SettingsSensitiveWords from '../../pages/Setting/Operation/SettingsSensitiveWords.js';
import SettingsLog from '../../pages/Setting/Operation/SettingsLog.js';
import SettingsMonitoring from '../../pages/Setting/Operation/SettingsMonitoring.js';
import SettingsCreditLimit from '../../pages/Setting/Operation/SettingsCreditLimit.js';
import { API, showError, toBoolean } from '../../helpers';

const OperationSetting = () => {
  let [inputs, setInputs] = useState({
    /* 额度相关 */
    QuotaForNewUser: 0,
    PreConsumedQuota: 0,
    QuotaForInviter: 0,
    QuotaForInvitee: 0,

    /* 通用设置 */
    TopUpLink: '',
    'general_setting.docs_link': '',
    QuotaPerUnit: 0,
    USDExchangeRate: 0,
    RetryTimes: 0,
    DisplayInCurrencyEnabled: false,
    DisplayTokenStatEnabled: false,
    DefaultCollapseSidebar: false,
    DemoSiteEnabled: false,
    SelfUseModeEnabled: false,

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
  });

  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (
          item.key.endsWith('Enabled') ||
          ['DefaultCollapseSidebar'].includes(item.key)
        ) {
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
    <>
      <Spin spinning={loading} size='large'>
        {/* 通用设置 */}
        <Card style={{ marginTop: '10px' }}>
          <SettingsGeneral options={inputs} refresh={onRefresh} />
        </Card>
        {/* 屏蔽词过滤设置 */}
        <Card style={{ marginTop: '10px' }}>
          <SettingsSensitiveWords options={inputs} refresh={onRefresh} />
        </Card>
        {/* 日志设置 */}
        <Card style={{ marginTop: '10px' }}>
          <SettingsLog options={inputs} refresh={onRefresh} />
        </Card>
        {/* 监控设置 */}
        <Card style={{ marginTop: '10px' }}>
          <SettingsMonitoring options={inputs} refresh={onRefresh} />
        </Card>
        {/* 额度设置 */}
        <Card style={{ marginTop: '10px' }}>
          <SettingsCreditLimit options={inputs} refresh={onRefresh} />
        </Card>
      </Spin>
    </>
  );
};

export default OperationSetting;
