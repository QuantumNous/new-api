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

import React, { useEffect, useState, useContext } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconEdit,
  IconDelete,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../../context/Status';

const { Text } = Typography;
const MAX_CUSTOM_ITEMS = 10;

export default function SettingsHeaderNavModules(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);

  // 顶栏模块管理状态
  const [headerNavModules, setHeaderNavModules] = useState({
    home: true,
    console: true,
    pricing: {
      enabled: true,
      requireAuth: false, // 默认不需要登录鉴权
    },
    docs: true,
    about: true,
  });

  // 自定义导航项状态
  const [customItems, setCustomItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formLabel, setFormLabel] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formOpenInNewTab, setFormOpenInNewTab] = useState(true);
  const [formPosition, setFormPosition] = useState(99);

  // 处理顶栏模块配置变更
  function handleHeaderNavModuleChange(moduleKey) {
    return (checked) => {
      const newModules = { ...headerNavModules };
      if (moduleKey === 'pricing') {
        // 对于pricing模块，只更新enabled属性
        newModules[moduleKey] = {
          ...newModules[moduleKey],
          enabled: checked,
        };
      } else {
        newModules[moduleKey] = checked;
      }
      setHeaderNavModules(newModules);
    };
  }

  // 处理模型广场权限控制变更
  function handlePricingAuthChange(checked) {
    const newModules = { ...headerNavModules };
    newModules.pricing = {
      ...newModules.pricing,
      requireAuth: checked,
    };
    setHeaderNavModules(newModules);
  }

  // 自定义导航项操作
  function resetCustomItemForm() {
    setFormLabel('');
    setFormUrl('');
    setFormOpenInNewTab(true);
    setFormPosition(99);
    setEditingItem(null);
  }

  function openAddModal() {
    if (customItems.length >= MAX_CUSTOM_ITEMS) {
      showError(
        t('最多添加 {{max}} 个自定义导航项', { max: MAX_CUSTOM_ITEMS }),
      );
      return;
    }
    resetCustomItemForm();
    setModalVisible(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setFormLabel(item.label);
    setFormUrl(item.url);
    setFormOpenInNewTab(item.openInNewTab);
    setFormPosition(item.position);
    setModalVisible(true);
  }

  function handleModalOk() {
    if (!formLabel.trim() || !formUrl.trim()) {
      showError(t('请填写完整信息'));
      return;
    }
    const normalizedUrl = formUrl.trim();
    const isExternal =
      normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://');

    if (editingItem) {
      setCustomItems((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                label: formLabel.trim(),
                url: normalizedUrl,
                isExternal,
                openInNewTab: isExternal ? formOpenInNewTab : false,
                position: formPosition,
              }
            : item,
        ),
      );
    } else {
      const newItem = {
        id: 'custom-' + Date.now(),
        label: formLabel.trim(),
        url: normalizedUrl,
        isExternal,
        openInNewTab: isExternal ? formOpenInNewTab : false,
        position: formPosition,
      };
      setCustomItems((prev) => [...prev, newItem]);
    }
    setModalVisible(false);
    resetCustomItemForm();
  }

  function deleteCustomItem(id) {
    setCustomItems((prev) => prev.filter((item) => item.id !== id));
  }

  // 重置顶栏模块为默认配置
  function resetHeaderNavModules() {
    const defaultModules = {
      home: true,
      console: true,
      pricing: {
        enabled: true,
        requireAuth: false,
      },
      docs: true,
      about: true,
    };
    setHeaderNavModules(defaultModules);
    setCustomItems([]);
    showSuccess(t('已重置为默认配置'));
  }

  // 保存配置
  async function onSubmit() {
    setLoading(true);
    try {
      const configToSave = { ...headerNavModules };
      if (customItems.length > 0) {
        configToSave.customItems = customItems;
      } else {
        delete configToSave.customItems;
      }
      const res = await API.put('/api/option/', {
        key: 'HeaderNavModules',
        value: JSON.stringify(configToSave),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));

        // 立即更新StatusContext中的状态
        statusDispatch({
          type: 'set',
          payload: {
            ...statusState.status,
            HeaderNavModules: JSON.stringify(configToSave),
          },
        });

        // 刷新父组件状态
        if (props.refresh) {
          await props.refresh();
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 从 props.options 中获取配置
    if (props.options && props.options.HeaderNavModules) {
      try {
        const modules = JSON.parse(props.options.HeaderNavModules);

        // 处理向后兼容性：如果pricing是boolean，转换为对象格式
        if (typeof modules.pricing === 'boolean') {
          modules.pricing = {
            enabled: modules.pricing,
            requireAuth: false, // 默认不需要登录鉴权
          };
        }

        // 提取customItems并从模块配置中移除
        const { customItems: loadedCustomItems, ...restModules } = modules;
        setCustomItems(Array.isArray(loadedCustomItems) ? loadedCustomItems : []);
        setHeaderNavModules(restModules);
      } catch (error) {
        // 使用默认配置
        const defaultModules = {
          home: true,
          console: true,
          pricing: {
            enabled: true,
            requireAuth: false,
          },
          docs: true,
          about: true,
        };
        setHeaderNavModules(defaultModules);
        setCustomItems([]);
      }
    }
  }, [props.options]);

  // 模块配置数据
  const moduleConfigs = [
    {
      key: 'home',
      title: t('首页'),
      description: t('用户主页，展示系统信息'),
    },
    {
      key: 'console',
      title: t('控制台'),
      description: t('用户控制面板，管理账户'),
    },
    {
      key: 'pricing',
      title: t('模型广场'),
      description: t('模型定价，需要登录访问'),
      hasSubConfig: true, // 标识该模块有子配置
    },
    {
      key: 'docs',
      title: t('文档'),
      description: t('系统文档和帮助信息'),
    },
    {
      key: 'about',
      title: t('关于'),
      description: t('关于系统的详细信息'),
    },
  ];

  return (
    <Card>
      <Form.Section
        text={t('顶栏管理')}
        extraText={t('控制顶栏模块显示状态，全局生效')}
      >
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          {moduleConfigs.map((module) => (
            <Col key={module.key} xs={24} sm={12} md={6} lg={6} xl={6}>
              <Card
                style={{
                  borderRadius: '8px',
                  border: '1px solid var(--semi-color-border)',
                  transition: 'all 0.2s ease',
                  background: 'var(--semi-color-bg-1)',
                  minHeight: '80px',
                }}
                bodyStyle={{ padding: '16px' }}
                hoverable
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div
                      style={{
                        fontWeight: '600',
                        fontSize: '14px',
                        color: 'var(--semi-color-text-0)',
                        marginBottom: '4px',
                      }}
                    >
                      {module.title}
                    </div>
                    <Text
                      type='secondary'
                      size='small'
                      style={{
                        fontSize: '12px',
                        color: 'var(--semi-color-text-2)',
                        lineHeight: '1.4',
                        display: 'block',
                      }}
                    >
                      {module.description}
                    </Text>
                  </div>
                  <div style={{ marginLeft: '16px' }}>
                    <Switch
                      checked={
                        module.key === 'pricing'
                          ? headerNavModules[module.key]?.enabled
                          : headerNavModules[module.key]
                      }
                      onChange={handleHeaderNavModuleChange(module.key)}
                      size='default'
                    />
                  </div>
                </div>

                {/* 为模型广场添加权限控制子开关 */}
                {module.key === 'pricing' &&
                  (module.key === 'pricing'
                    ? headerNavModules[module.key]?.enabled
                    : headerNavModules[module.key]) && (
                    <div
                      style={{
                        borderTop: '1px solid var(--semi-color-border)',
                        marginTop: '12px',
                        paddingTop: '12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div
                            style={{
                              fontWeight: '500',
                              fontSize: '12px',
                              color: 'var(--semi-color-text-1)',
                              marginBottom: '2px',
                            }}
                          >
                            {t('需要登录访问')}
                          </div>
                          <Text
                            type='secondary'
                            size='small'
                            style={{
                              fontSize: '11px',
                              color: 'var(--semi-color-text-2)',
                              lineHeight: '1.4',
                              display: 'block',
                            }}
                          >
                            {t('开启后未登录用户无法访问模型广场')}
                          </Text>
                        </div>
                        <div style={{ marginLeft: '16px' }}>
                          <Switch
                            checked={
                              headerNavModules.pricing?.requireAuth || false
                            }
                            onChange={handlePricingAuthChange}
                            size='default'
                          />
                        </div>
                      </div>
                    </div>
                  )}
              </Card>
            </Col>
          ))}
        </Row>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingTop: '8px',
            borderTop: '1px solid var(--semi-color-border)',
          }}
        >
          <Button
            size='default'
            type='tertiary'
            onClick={resetHeaderNavModules}
            style={{
              borderRadius: '6px',
              fontWeight: '500',
            }}
          >
            {t('重置为默认')}
          </Button>
        </div>
      </Form.Section>

      <Form.Section
        text={t('自定义导航项')}
        style={{ marginTop: '24px' }}
      >
        <Table
          dataSource={customItems}
          rowKey='id'
          size='small'
          pagination={false}
          empty={
            <Text type='tertiary'>{t('暂无自定义导航项')}</Text>
          }
          columns={[
            {
              title: t('名称'),
              dataIndex: 'label',
              key: 'label',
            },
            {
              title: t('链接地址'),
              dataIndex: 'url',
              key: 'url',
              render: (text) => (
                <Text
                  copyable
                  ellipsis={{ showTooltip: true }}
                  style={{ maxWidth: 200 }}
                >
                  {text}
                </Text>
              ),
            },
            {
              title: t('类型'),
              dataIndex: 'isExternal',
              key: 'type',
              render: (isExternal) =>
                isExternal ? (
                  <Tag color='blue'>{t('外部链接')}</Tag>
                ) : (
                  <Tag color='green'>{t('内部路径')}</Tag>
                ),
            },
            {
              title: t('显示位置'),
              dataIndex: 'position',
              key: 'position',
              render: (pos) => {
                const posLabels = {
                  0: t('在最前面'),
                  1: t('首页之后'),
                  2: t('控制台之后'),
                  3: t('模型广场之后'),
                  4: t('文档之后'),
                  5: t('关于之后'),
                  99: t('在最后面'),
                };
                return posLabels[pos] || pos;
              },
            },
            {
              title: t('操作'),
              key: 'actions',
              render: (_, record) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    icon={<IconEdit />}
                    size='small'
                    type='tertiary'
                    aria-label={t('编辑') + ' ' + (record.label || '')}
                    onClick={() => openEditModal(record)}
                  />
                  <Button
                    icon={<IconDelete />}
                    size='small'
                    type='danger'
                    aria-label={t('删除') + ' ' + (record.label || '')}
                    onClick={() => deleteCustomItem(record.id)}
                  />
                </div>
              ),
            },
          ]}
        />
        <Button
          icon={<IconPlus />}
          onClick={openAddModal}
          style={{ marginTop: '12px' }}
          disabled={customItems.length >= MAX_CUSTOM_ITEMS}
        >
          {t('添加导航项')}
        </Button>
        {customItems.length >= MAX_CUSTOM_ITEMS && (
          <Text
            type='tertiary'
            size='small'
            style={{ marginLeft: '12px' }}
          >
            {t('最多添加 {{max}} 个自定义导航项', {
              max: MAX_CUSTOM_ITEMS,
            })}
          </Text>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            paddingTop: '16px',
            marginTop: '16px',
            borderTop: '1px solid var(--semi-color-border)',
          }}
        >
          <Button
            size='default'
            type='primary'
            onClick={onSubmit}
            loading={loading}
            style={{
              borderRadius: '6px',
              fontWeight: '500',
              minWidth: '100px',
            }}
          >
            {t('保存设置')}
          </Button>
        </div>
      </Form.Section>

      <Modal
        title={editingItem ? t('编辑导航项') : t('添加导航项')}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false);
          resetCustomItemForm();
        }}
        maskClosable={false}
      >
        <Form layout='vertical'>
          <Form.Slot label={t('名称')}>
            <Input
              value={formLabel}
              onChange={setFormLabel}
              placeholder={t('名称')}
            />
          </Form.Slot>
          <Form.Slot label={t('链接地址')}>
            <Input
              value={formUrl}
              onChange={setFormUrl}
              placeholder={t('链接示例: https://example.com 或 /path')}
            />
          </Form.Slot>
          {(formUrl.trim().startsWith('http://') ||
            formUrl.trim().startsWith('https://')) && (
            <Form.Slot label={t('在新标签页打开')}>
              <Switch
                checked={formOpenInNewTab}
                onChange={setFormOpenInNewTab}
              />
            </Form.Slot>
          )}
          <Form.Slot label={t('显示位置')}>
            <Select
              value={formPosition}
              onChange={setFormPosition}
              style={{ width: '100%' }}
            >
              <Select.Option value={0}>
                {t('在最前面')}
              </Select.Option>
              <Select.Option value={1}>
                {t('首页之后')}
              </Select.Option>
              <Select.Option value={2}>
                {t('控制台之后')}
              </Select.Option>
              <Select.Option value={3}>
                {t('模型广场之后')}
              </Select.Option>
              <Select.Option value={4}>
                {t('文档之后')}
              </Select.Option>
              <Select.Option value={5}>
                {t('关于之后')}
              </Select.Option>
              <Select.Option value={99}>
                {t('在最后面')}
              </Select.Option>
            </Select>
          </Form.Slot>
        </Form>
      </Modal>
    </Card>
  );
}
