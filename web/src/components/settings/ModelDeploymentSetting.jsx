import React, { useEffect, useState } from 'react';
import { Card, Spin } from '@douyinfe/semi-ui';
import { API, showError, toBoolean } from '../../helpers';
import { useTranslation } from 'react-i18next';
import SettingModelDeployment from '../../pages/Setting/Model/SettingModelDeployment';

const ModelDeploymentSetting = () => {
  const { t } = useTranslation();
  let [inputs, setInputs] = useState({
    'model_deployment.ionet.api_key': '',
    'model_deployment.ionet.enabled': false,
  });

  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {
        'model_deployment.ionet.api_key': '',
        'model_deployment.ionet.enabled': false,
      };

      data.forEach((item) => {
        if (item.key.endsWith('Enabled') || item.key.endsWith('enabled')) {
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

  return (
    <>
      <Spin spinning={loading} size='large'>
        <Card style={{ marginTop: '10px' }}>
          <SettingModelDeployment options={inputs} refresh={onRefresh} />
        </Card>
      </Spin>
    </>
  );
};

export default ModelDeploymentSetting;
