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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDelete, IconEdit, IconPlus } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

import { API, showError, showSuccess, toBoolean } from '../../../helpers';

const KEY_ENABLED = 'refusal_fallback_setting.enabled';
const KEY_RULES = 'refusal_fallback_setting.rules';

const parseRules = (raw) => {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((rule, index) => ({ id: index, ...(rule || {}) }));
  } catch {
    return [];
  }
};

const serializeRules = (rules) =>
  JSON.stringify(
    rules.map((rule) => {
      const { id, ...payload } = rule;
      return payload;
    }),
  );

const splitList = (value) =>
  (value || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const regexListIsValid = (patterns) => {
  try {
    patterns.forEach((pattern) => new RegExp(pattern));
    return true;
  } catch {
    return false;
  }
};

const parseGroupNames = (raw) => {
  try {
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return [];
    return Object.keys(parsed)
      .filter((group) => group !== 'auto')
      .sort();
  } catch {
    return [];
  }
};

const emptyDraft = () => ({
  id: -1,
  name: '',
  modelRegex: '',
  pathRegex: '^/v1/messages$',
  groups: '',
  fallbackGroup: '',
  cooldownSeconds: 3600,
});

export default function SettingsRefusalFallback(props) {
  const { t } = useTranslation();
  const { Text } = Typography;
  const [enabled, setEnabled] = useState(false);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());

  useEffect(() => {
    setEnabled(toBoolean(props.options?.[KEY_ENABLED]));
    setRules(parseRules(props.options?.[KEY_RULES]));
  }, [props.options]);

  const configuredGroups = useMemo(
    () => parseGroupNames(props.options?.GroupRatio),
    [props.options],
  );

  const groupOptions = useMemo(() => {
    const options = configuredGroups.map((group) => ({
      value: group,
      label: group,
    }));
    if (
      draft.fallbackGroup &&
      !configuredGroups.includes(draft.fallbackGroup)
    ) {
      options.push({
        value: draft.fallbackGroup,
        label: `${draft.fallbackGroup} · ${t('分组不可用')}`,
        disabled: true,
      });
    }
    return options.sort((left, right) => left.value.localeCompare(right.value));
  }, [configuredGroups, draft.fallbackGroup, t]);

  const openAddModal = () => {
    setDraft(emptyDraft());
    setModalVisible(true);
  };

  const openEditModal = (rule) => {
    setDraft({
      id: rule.id,
      name: rule.name || '',
      modelRegex: (rule.model_regex || []).join('\n'),
      pathRegex: (rule.path_regex || []).join('\n'),
      groups: (rule.groups || []).join('\n'),
      fallbackGroup: rule.fallback_group || '',
      cooldownSeconds: Number(rule.cooldown_seconds || 3600),
    });
    setModalVisible(true);
  };

  const saveDraft = () => {
    const name = draft.name.trim();
    const modelRegex = splitList(draft.modelRegex);
    const pathRegex = splitList(draft.pathRegex);
    const groups = splitList(draft.groups);

    if (!name) return showError(t('规则名称不能为空'));
    if (rules.some((rule) => rule.name === name && rule.id !== draft.id)) {
      return showError(t('规则名称必须唯一'));
    }
    if (modelRegex.length === 0) {
      return showError(t('至少填写一个模型正则'));
    }
    if (!regexListIsValid([...modelRegex, ...pathRegex])) {
      return showError(t('模型或路径正则格式不正确'));
    }
    if (!draft.fallbackGroup) {
      return showError(t('请选择备用分组'));
    }
    if (
      draft.cooldownSeconds <= 0 ||
      draft.cooldownSeconds > 30 * 24 * 60 * 60
    ) {
      return showError(t('冷却时间必须在 1 秒到 30 天之间'));
    }

    const rule = {
      id: draft.id,
      name,
      model_regex: modelRegex,
      ...(pathRegex.length > 0 ? { path_regex: pathRegex } : {}),
      ...(groups.length > 0 ? { groups } : {}),
      fallback_group: draft.fallbackGroup,
      cooldown_seconds: draft.cooldownSeconds,
    };
    setRules((current) => {
      if (draft.id >= 0) {
        return current.map((item) => (item.id === draft.id ? rule : item));
      }
      return [...current, { ...rule, id: current.length }];
    });
    setModalVisible(false);
  };

  const deleteRule = (id) => {
    setRules((current) =>
      current
        .filter((rule) => rule.id !== id)
        .map((rule, index) => ({ ...rule, id: index })),
    );
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const rulesUpdate = { key: KEY_RULES, value: serializeRules(rules) };
      const enabledUpdate = { key: KEY_ENABLED, value: String(enabled) };
      const updates = enabled
        ? [rulesUpdate, enabledUpdate]
        : [enabledUpdate, rulesUpdate];
      for (const update of updates) {
        const response = await API.put('/api/option/', update);
        if (!response.data.success) {
          showError(response.data.message || t('保存失败'));
          return;
        }
      }
      showSuccess(t('保存成功'));
      await props.refresh();
    } catch (error) {
      showError(error.message || t('保存失败'));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('名称'),
      dataIndex: 'name',
    },
    {
      title: t('模型正则'),
      dataIndex: 'model_regex',
      render: (values) => (
        <Space wrap>
          {(values || []).map((value) => (
            <Tag key={value}>{value}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('分组'),
      dataIndex: 'groups',
      render: (values) => (values || []).join(', ') || t('全部分组'),
    },
    {
      title: t('备用分组'),
      dataIndex: 'fallback_group',
    },
    {
      title: t('冷却时间（秒）'),
      dataIndex: 'cooldown_seconds',
    },
    {
      title: t('操作'),
      render: (_, rule) => (
        <Space>
          <Button
            icon={<IconEdit />}
            type='tertiary'
            onClick={() => openEditModal(rule)}
          />
          <Button
            icon={<IconDelete />}
            type='danger'
            onClick={() => deleteRule(rule.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <>
      <Form style={{ marginBottom: 15 }}>
        <Form.Section text={t('拒绝备用路由')}>
          <Banner
            fullMode={false}
            type='info'
            description={t(
              '上游返回 refusal 后，同一令牌、模型和分组会在固定冷却期内通过备用分组选路；冷却结束后自动探测首选线路。',
            )}
          />
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Space vertical align='start'>
                <Switch checked={enabled} onChange={setEnabled} />
                <Text>{t('启用拒绝备用路由')}</Text>
                <Text type='tertiary' size='small'>
                  {t(
                    '备用请求不会续期冷却时间；备用分组只影响选路，计费仍使用用户原分组。',
                  )}
                </Text>
              </Space>
            </Col>
          </Row>
          <Space style={{ marginTop: 16, marginBottom: 12 }}>
            <Button icon={<IconPlus />} onClick={openAddModal}>
              {t('新增规则')}
            </Button>
            <Button theme='solid' loading={loading} onClick={saveSettings}>
              {t('保存')}
            </Button>
          </Space>
          <Table
            columns={columns}
            dataSource={rules}
            rowKey='id'
            pagination={false}
            size='small'
            empty={t('暂无拒绝备用路由规则')}
          />
        </Form.Section>
      </Form>

      <Modal
        title={draft.id >= 0 ? t('编辑规则') : t('新增规则')}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={saveDraft}
        okText={t('保存')}
        cancelText={t('取消')}
        width={720}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Text>{t('名称')}</Text>
            <Input
              value={draft.name}
              onChange={(value) => setDraft({ ...draft, name: value })}
              placeholder={t('例如 Claude refusal fallback')}
            />
          </Col>
          <Col span={12} style={{ marginTop: 14 }}>
            <Text>{t('模型正则（每行一个）')}</Text>
            <Input.TextArea
              value={draft.modelRegex}
              onChange={(value) => setDraft({ ...draft, modelRegex: value })}
              autosize={{ minRows: 4, maxRows: 8 }}
              placeholder='^claude-sonnet-.*$'
            />
          </Col>
          <Col span={12} style={{ marginTop: 14 }}>
            <Text>{t('路径正则（可选，每行一个）')}</Text>
            <Input.TextArea
              value={draft.pathRegex}
              onChange={(value) => setDraft({ ...draft, pathRegex: value })}
              autosize={{ minRows: 4, maxRows: 8 }}
            />
          </Col>
          <Col span={12} style={{ marginTop: 14 }}>
            <Text>{t('备用分组')}</Text>
            <Select
              value={draft.fallbackGroup || undefined}
              optionList={groupOptions}
              filter
              style={{ width: '100%' }}
              placeholder={t('请选择备用分组')}
              onChange={(value) =>
                setDraft({ ...draft, fallbackGroup: value || '' })
              }
            />
          </Col>
          <Col span={12} style={{ marginTop: 14 }}>
            <Text>{t('冷却时间（秒）')}</Text>
            <InputNumber
              value={draft.cooldownSeconds}
              min={1}
              max={30 * 24 * 60 * 60}
              style={{ width: '100%' }}
              onChange={(value) =>
                setDraft({ ...draft, cooldownSeconds: Number(value || 0) })
              }
            />
          </Col>
          <Col span={24} style={{ marginTop: 14 }}>
            <Text>{t('分组（可选，逗号分隔）')}</Text>
            <Input
              value={draft.groups}
              onChange={(value) => setDraft({ ...draft, groups: value })}
            />
          </Col>
        </Row>
      </Modal>
    </>
  );
}
