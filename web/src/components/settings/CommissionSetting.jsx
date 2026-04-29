import React, { useEffect, useState } from 'react';
import { Card, Spin, Tabs } from '@douyinfe/semi-ui';
import SettingsCommission from '../../pages/Setting/Commission/SettingsCommission';
import CommissionWithdrawalManagement from '../../pages/Setting/Commission/CommissionWithdrawalManagement';
import CommissionManualIssue from '../../pages/Setting/Commission/CommissionManualIssue';
import { API, showError, toBoolean } from '../../helpers';
import { useTranslation } from 'react-i18next';

const CommissionSetting = () => {
  const { t } = useTranslation();
  let [inputs, setInputs] = useState({
    CommissionEnabled: false,
    CommissionTopUpRatio1: 0,
    CommissionTopUpRatio2: 0,
    CommissionTopUpRatio3: 0,
    CommissionHighValueThreshold: 0,
    CommissionHighValueBonus: 0,
    CommissionMinWithdraw: 10,
    CommissionNotice: '',
  });

  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        switch (item.key) {
          case 'CommissionEnabled':
            newInputs[item.key] = toBoolean(item.value);
            break;
          case 'CommissionTopUpRatio1':
          case 'CommissionTopUpRatio2':
          case 'CommissionTopUpRatio3':
          case 'CommissionHighValueThreshold':
          case 'CommissionHighValueBonus':
          case 'CommissionMinWithdraw':
            newInputs[item.key] = parseFloat(item.value) || 0;
            break;
          case 'CommissionNotice':
            newInputs[item.key] = item.value || '';
            break;
          default:
            break;
        }
      });

      setInputs((prev) => ({ ...prev, ...newInputs }));
    } else {
      showError(t(message));
    }
  };

  async function onRefresh() {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError(t('刷新失败'));
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
        <Card style={{ marginTop: '10px' }}>
          <Tabs
            type='card'
            defaultActiveKey='settings'
            contentStyle={{ paddingTop: 24 }}
          >
            <Tabs.TabPane tab={t('返佣配置')} itemKey='settings'>
              <SettingsCommission
                options={inputs}
                refresh={onRefresh}
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab={t('提现管理')} itemKey='withdrawals'>
              <CommissionWithdrawalManagement />
            </Tabs.TabPane>
            <Tabs.TabPane tab={t('手动发放')} itemKey='manual'>
              <CommissionManualIssue />
            </Tabs.TabPane>
          </Tabs>
        </Card>
      </Spin>
    </>
  );
};

export default CommissionSetting;
