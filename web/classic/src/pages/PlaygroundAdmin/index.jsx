import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Spin, Typography, Divider } from '@douyinfe/semi-ui';
import { API, showError } from '../../helpers';
import SettingsSidebarModulesAdmin from '../Setting/Operation/SettingsSidebarModulesAdmin';
import SettingsPlaygroundTabs from '../Setting/Operation/SettingsPlaygroundTabs';
import SettingsImageSizes from '../Setting/Operation/SettingsImageSizes';
import SettingsVideoModels from '../Setting/Operation/SettingsVideoModels';
import SettingsAudioModels from '../Setting/Operation/SettingsAudioModels';
import SettingsMusicModels from '../Setting/Operation/SettingsMusicModels';

const { Title, Text } = Typography;

// 「体验区管理」统一页：分类显示 → tab 显示 → 各分类模型与选项。
// 复用运营设置里已有的编辑器（模型/能力/选项），外加分类显隐 + tab 显隐两层控制，
// 把原来散落在运营设置里的体验区相关配置集中到这一页做精细化管理。
const PlaygroundAdmin = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({});

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      const next = {};
      data.forEach((item) => {
        next[item.key] = item.value;
      });
      setInputs(next);
    } else {
      showError(message);
    }
  };

  const onRefresh = async () => {
    try {
      setLoading(true);
      await getOptions();
    } catch (e) {
      showError(t('刷新失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    onRefresh();
  }, []);

  const section = (title, node) => (
    <div style={{ marginTop: 10 }}>
      <Title heading={5} style={{ margin: '8px 0' }}>
        {title}
      </Title>
      {node}
    </div>
  );

  return (
    <div className='mt-[64px] px-3 pb-6'>
      <Card>
        <Title heading={4}>{t('体验区管理')}</Title>
        <Text type='tertiary'>
          {t(
            '集中管理体验区：控制左侧分类与各分类下 tab 的显示，配置每个 tab 的模型（决定其能力标签）及模型选项。配置对接口、网页端、移动端同时生效。',
          )}
        </Text>
      </Card>

      <Spin spinning={loading}>
        {section(
          t('分类显示'),
          <SettingsSidebarModulesAdmin options={inputs} refresh={onRefresh} />,
        )}
        {section(
          t('Tab 显示'),
          <SettingsPlaygroundTabs options={inputs} refresh={onRefresh} />,
        )}

        <Divider margin='16px' />

        {section(
          t('图像模型'),
          <SettingsImageSizes options={inputs} refresh={onRefresh} />,
        )}
        {section(
          t('视频模型'),
          <SettingsVideoModels options={inputs} refresh={onRefresh} />,
        )}
        {section(
          t('语音模型'),
          <SettingsAudioModels options={inputs} refresh={onRefresh} />,
        )}
        {section(
          t('音乐模型'),
          <SettingsMusicModels options={inputs} refresh={onRefresh} />,
        )}
      </Spin>
    </div>
  );
};

export default PlaygroundAdmin;
