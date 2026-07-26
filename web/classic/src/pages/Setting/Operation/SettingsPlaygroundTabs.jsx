import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Switch, Typography, Divider } from '@douyinfe/semi-ui';
import { API, showSuccess, showError } from '../../../helpers';
import { StatusContext } from '../../../context/Status';
import {
  PLAYGROUND_CATEGORIES,
  parsePlaygroundTabConfig,
  isPlaygroundTabVisible,
} from '../../../constants/playgroundAdmin.constants';

const { Text, Title } = Typography;

// 体验区各分类下 tab 的显示开关。写 PlaygroundTabConfig（{category:{modeKey:bool}}）。
// 缺省=显示；仅显式关闭才隐藏。文本模型无 tab，不在此列。
export default function SettingsPlaygroundTabs(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);
  const [config, setConfig] = useState({});

  useEffect(() => {
    setConfig(parsePlaygroundTabConfig(props.options?.PlaygroundTabConfig));
  }, [props.options?.PlaygroundTabConfig]);

  const categories = PLAYGROUND_CATEGORIES.filter((c) => c.tabs.length > 0);

  const setTab = (catKey, modeKey, checked) => {
    setConfig((prev) => ({
      ...prev,
      [catKey]: { ...(prev[catKey] || {}), [modeKey]: checked },
    }));
  };

  async function onSubmit() {
    setLoading(true);
    try {
      const value = JSON.stringify(config);
      const res = await API.put('/api/option/', {
        key: 'PlaygroundTabConfig',
        value,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));
        statusDispatch({
          type: 'set',
          payload: { ...statusState.status, PlaygroundTabConfig: value },
        });
        if (props.refresh) await props.refresh();
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <Title heading={6} style={{ marginBottom: 4 }}>
        {t('体验区 Tab 显示')}
      </Title>
      <Text type='tertiary' size='small'>
        {t('控制各分类下的子标签页是否显示（关闭后网页端与移动端均隐藏）')}
      </Text>
      <Divider margin='12px' />
      {categories.map((cat) => (
        <div key={cat.key} style={{ marginBottom: 16 }}>
          <Text strong>{t(cat.label)}</Text>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 20,
              marginTop: 8,
            }}
          >
            {cat.tabs.map((tb) => (
              <div
                key={tb.key}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Switch
                  size='small'
                  checked={isPlaygroundTabVisible(config, cat.key, tb.key)}
                  onChange={(v) => setTab(cat.key, tb.key, v)}
                />
                <Text size='small'>{t(tb.label)}</Text>
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button theme='solid' loading={loading} onClick={onSubmit}>
        {t('保存')}
      </Button>
    </Card>
  );
}
