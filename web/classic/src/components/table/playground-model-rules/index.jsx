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
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconRefresh,
  IconSave,
  IconSearch,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  API,
  selectFilter,
  showError,
  showSuccess,
} from '../../../helpers';
import {
  PLAYGROUND_CATEGORY_KEYS,
  PLAYGROUND_MODEL_CATEGORY_OPTIONS,
  applyCategoryRebalance,
  buildPlaygroundModelCollections,
  buildPlaygroundRuleMap,
  calculateInsertedOrder,
  detectAutoPlaygroundCategories,
  getPlaygroundRuleOrder,
  parsePlaygroundModelRules,
  serializePlaygroundModelRules,
  sortModelNamesNatural,
} from '../../../helpers/playgroundModelRules';

const RULE_OPTION_KEY = 'PlaygroundModelRules';

const createEmptyOrders = () => ({
  chat: null,
  image: null,
  video: null,
});

const hasAnyOrderValue = (orders = {}) =>
  PLAYGROUND_CATEGORY_KEYS.some(
    (category) => orders?.[category] !== null && orders?.[category] !== undefined,
  );

const normalizeOrderValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getRuleDraftFromMap = (ruleMap, modelName) => {
  const rule = ruleMap.get(modelName);
  return {
    orders: {
      chat: getPlaygroundRuleOrder(rule, 'chat'),
      image: getPlaygroundRuleOrder(rule, 'image'),
      video: getPlaygroundRuleOrder(rule, 'video'),
    },
    categories: Array.isArray(rule?.categories) ? rule.categories : [],
    hasCategoryOverride: Boolean(rule?.hasCategoryOverride),
  };
};

const createTagList = (categories, emptyLabel) => {
  if (!categories || categories.length === 0) {
    return <Typography.Text type='tertiary'>{emptyLabel}</Typography.Text>;
  }

  return (
    <Space wrap>
      {categories.map((category) => {
        const option = PLAYGROUND_MODEL_CATEGORY_OPTIONS.find(
          (item) => item.value === category,
        );
        return (
          <Tag key={category} color='cyan' shape='circle'>
            {option?.label || category}
          </Tag>
        );
      })}
    </Space>
  );
};

const updateStoredPlaygroundModelRules = (serializedRules) => {
  try {
    localStorage.setItem('playground_model_rules', serializedRules);
    const rawStatus = localStorage.getItem('status');
    if (!rawStatus) {
      return;
    }
    const parsedStatus = JSON.parse(rawStatus);
    parsedStatus.playground_model_rules = serializedRules;
    localStorage.setItem('status', JSON.stringify(parsedStatus));
    window.dispatchEvent(
      new CustomEvent('playground-model-rules-updated', {
        detail: {
          playgroundModelRules: serializedRules,
        },
      }),
    );
  } catch (error) {}
};

const categoryListKeyMap = {
  chat: 'chatModels',
  image: 'imageModels',
  video: 'videoModels',
};

const PlaygroundModelRulesTable = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [pricingItems, setPricingItems] = useState([]);
  const [rulesByModel, setRulesByModel] = useState({});
  const [dragState, setDragState] = useState({
    category: '',
    draggedModel: '',
    targetModel: '',
    position: 'before',
  });

  const categorySections = useMemo(
    () => [
      { key: 'chat', title: t('聊天模型') },
      { key: 'image', title: t('图片模型') },
      { key: 'video', title: t('视频模型') },
    ],
    [t],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [pricingRes, optionsRes] = await Promise.all([
        API.get('/api/pricing'),
        API.get('/api/option/'),
      ]);

      const pricingPayload = pricingRes.data || {};
      const optionPayload = optionsRes.data || {};

      if (!pricingPayload.success) {
        showError(pricingPayload.message || t('加载模型列表失败'));
        return;
      }
      if (!optionPayload.success) {
        showError(optionPayload.message || t('加载配置失败'));
        return;
      }

      const nextPricingItems = Array.isArray(pricingPayload.data)
        ? pricingPayload.data
        : [];
      const rawRuleValue =
        optionPayload.data?.find((item) => item.key === RULE_OPTION_KEY)?.value ||
        '[]';
      const ruleMap = buildPlaygroundRuleMap(rawRuleValue);
      const nextRulesByModel = {};
      ruleMap.forEach((rule, modelName) => {
        nextRulesByModel[modelName] = getRuleDraftFromMap(ruleMap, modelName);
      });

      setPricingItems(nextPricingItems);
      setRulesByModel(nextRulesByModel);
    } catch (error) {
      showError(error.response?.data?.message || t('加载配置失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const mergedModels = useMemo(() => {
    const names = new Set();
    pricingItems.forEach((item) => {
      const modelName = String(item?.model_name || '').trim();
      if (modelName) {
        names.add(modelName);
      }
    });
    Object.keys(rulesByModel).forEach((modelName) => {
      if (modelName) {
        names.add(modelName);
      }
    });
    return sortModelNamesNatural(Array.from(names));
  }, [pricingItems, rulesByModel]);

  const endpointTypesByModel = useMemo(() => {
    const result = new Map();
    pricingItems.forEach((item) => {
      const modelName = String(item?.model_name || '').trim();
      if (!modelName) {
        return;
      }
      const endpointTypes = Array.isArray(item?.supported_endpoint_types)
        ? item.supported_endpoint_types
        : [];
      const merged = result.get(modelName) || new Set();
      endpointTypes.forEach((endpointType) => merged.add(endpointType));
      result.set(modelName, merged);
    });
    return result;
  }, [pricingItems]);

  const serializedRules = useMemo(() => {
    const draftRules = Object.entries(rulesByModel)
      .map(([model, rule]) => {
        if (!rule) {
          return null;
        }
        const hasCategoryOverride = Boolean(rule.hasCategoryOverride);
        const hasOrder = hasAnyOrderValue(rule.orders);
        if (!hasCategoryOverride && !hasOrder) {
          return null;
        }
        return {
          model,
          ...(hasCategoryOverride ? { categories: rule.categories || [] } : {}),
          ...(hasOrder ? { orders: rule.orders } : {}),
        };
      })
      .filter(Boolean);

    return serializePlaygroundModelRules(draftRules);
  }, [rulesByModel]);

  const configuredRuleCount = useMemo(
    () => parsePlaygroundModelRules(serializedRules).length,
    [serializedRules],
  );

  const effectiveCollections = useMemo(
    () => buildPlaygroundModelCollections(pricingItems, serializedRules),
    [pricingItems, serializedRules],
  );

  const searchKeyword = searchText.trim().toLowerCase();

  const modelRows = useMemo(() => {
    return mergedModels
      .filter((modelName) => {
        if (!searchKeyword) {
          return true;
        }
        return modelName.toLowerCase().includes(searchKeyword);
      })
      .map((modelName) => {
        const endpointTypes = Array.from(endpointTypesByModel.get(modelName) || []);
        const autoCategories = detectAutoPlaygroundCategories(
          modelName,
          endpointTypes,
        );
        const draftRule = rulesByModel[modelName] || {
          orders: createEmptyOrders(),
          categories: [],
          hasCategoryOverride: false,
        };
        const effectiveCategories = draftRule.hasCategoryOverride
          ? draftRule.categories
          : autoCategories;

        return {
          key: modelName,
          model: modelName,
          autoCategories,
          effectiveCategories,
          categories: draftRule.categories,
          orders: {
            chat: normalizeOrderValue(draftRule.orders?.chat),
            image: normalizeOrderValue(draftRule.orders?.image),
            video: normalizeOrderValue(draftRule.orders?.video),
          },
          hasCategoryOverride: draftRule.hasCategoryOverride,
        };
      });
  }, [endpointTypesByModel, mergedModels, rulesByModel, searchKeyword]);

  const modelRowMap = useMemo(
    () => new Map(modelRows.map((row) => [row.model, row])),
    [modelRows],
  );

  const updateRule = (modelName, updater) => {
    setRulesByModel((current) => {
      const baseRule = current[modelName] || {
        orders: createEmptyOrders(),
        categories: [],
        hasCategoryOverride: false,
      };

      const resolvedPatch =
        typeof updater === 'function' ? updater(baseRule) : updater || {};

      const nextRule = {
        orders: {
          ...createEmptyOrders(),
          ...(baseRule.orders || {}),
          ...(resolvedPatch.orders || {}),
        },
        categories:
          resolvedPatch.categories !== undefined
            ? resolvedPatch.categories
            : baseRule.categories,
        hasCategoryOverride:
          resolvedPatch.hasCategoryOverride !== undefined
            ? Boolean(resolvedPatch.hasCategoryOverride)
            : Boolean(baseRule.hasCategoryOverride),
      };

      PLAYGROUND_CATEGORY_KEYS.forEach((category) => {
        nextRule.orders[category] = normalizeOrderValue(nextRule.orders[category]);
      });

      const hasCategoryOverride = Boolean(nextRule.hasCategoryOverride);
      const hasOrder = hasAnyOrderValue(nextRule.orders);
      if (!hasCategoryOverride && !hasOrder) {
        const nextState = { ...current };
        delete nextState[modelName];
        return nextState;
      }

      return {
        ...current,
        [modelName]: nextRule,
      };
    });
  };

  const updateCategoryVisibility = (modelName, category, checked) => {
    const currentRow = modelRowMap.get(modelName);
    if (!currentRow) {
      return;
    }

    const nextCategories = new Set(currentRow.effectiveCategories);
    if (checked) {
      nextCategories.add(category);
    } else {
      nextCategories.delete(category);
    }

    updateRule(modelName, {
      hasCategoryOverride: true,
      categories: PLAYGROUND_CATEGORY_KEYS.filter((item) => nextCategories.has(item)),
    });
  };

  const resetRule = (modelName) => {
    setRulesByModel((current) => {
      const nextState = { ...current };
      delete nextState[modelName];
      return nextState;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await API.put('/api/option/', {
        key: RULE_OPTION_KEY,
        value: serializedRules,
      });
      const { success, message } = res.data || {};
      if (!success) {
        showError(message || t('保存失败'));
        return;
      }
      updateStoredPlaygroundModelRules(serializedRules);
      showSuccess(t('保存成功'));
      await loadData();
    } catch (error) {
      showError(error.response?.data?.message || t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const reorderCategoryModels = (category, draggedModel, targetModel, position) => {
    const categoryModels = effectiveCollections[categoryListKeyMap[category]] || [];
    const sourceIndex = categoryModels.indexOf(draggedModel);
    const targetIndex = categoryModels.indexOf(targetModel);

    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return;
    }

    const nextOrderValue = calculateInsertedOrder({
      orderedModels: categoryModels,
      ordersByModel: Object.fromEntries(
        categoryModels.map((modelName) => [
          modelName,
          modelRowMap.get(modelName)?.orders?.[category] ?? null,
        ]),
      ),
      draggedModel,
      targetModel,
      position,
    });

    if (nextOrderValue !== null) {
      updateRule(draggedModel, (currentRule) => ({
        orders: {
          ...(currentRule.orders || {}),
          [category]: nextOrderValue,
        },
      }));
      return;
    }

    const reorderedModels = [...categoryModels];
    reorderedModels.splice(sourceIndex, 1);
    const targetIndexAfterRemoval = reorderedModels.indexOf(targetModel);
    const insertIndex =
      position === 'after'
        ? targetIndexAfterRemoval + 1
        : targetIndexAfterRemoval;
    reorderedModels.splice(insertIndex, 0, draggedModel);

    setRulesByModel((current) =>
      applyCategoryRebalance({
        rulesByModel: current,
        orderedModels: reorderedModels,
        category,
      }),
    );
  };

  const rebalanceCategory = (category) => {
    const categoryModels = effectiveCollections[categoryListKeyMap[category]] || [];
    setRulesByModel((current) =>
      applyCategoryRebalance({
        rulesByModel: current,
        orderedModels: categoryModels,
        category,
      }),
    );
    showSuccess(t('已按当前顺序重排序'));
  };

  const classificationColumns = [
    {
      title: t('模型名称'),
      dataIndex: 'model',
      key: 'model',
      width: 280,
      render: (text) => <Typography.Text copyable>{text}</Typography.Text>,
    },
    {
      title: t('自动分类'),
      dataIndex: 'autoCategories',
      key: 'autoCategories',
      width: 180,
      render: (categories) => createTagList(categories, t('未自动识别')),
    },
    ...categorySections.map((section) => ({
      title: section.title,
      dataIndex: section.key,
      key: section.key,
      width: 120,
      render: (_, record) => (
        <Switch
          checked={record.effectiveCategories.includes(section.key)}
          onChange={(checked) =>
            updateCategoryVisibility(record.model, section.key, checked)
          }
        />
      ),
    })),
    {
      title: t('覆盖分类'),
      dataIndex: 'hasCategoryOverride',
      key: 'hasCategoryOverride',
      width: 120,
      render: (value, record) => (
        <Switch
          checked={Boolean(value)}
          onChange={(checked) => {
            if (checked) {
              updateRule(record.model, {
                hasCategoryOverride: true,
                categories: record.effectiveCategories,
              });
              return;
            }
            updateRule(record.model, {
              hasCategoryOverride: false,
              categories: [],
            });
          }}
        />
      ),
    },
    {
      title: t('自定义分类'),
      dataIndex: 'categories',
      key: 'categories',
      width: 260,
      render: (categories, record) => (
        <Select
          multiple
          disabled={!record.hasCategoryOverride}
          value={categories}
          optionList={PLAYGROUND_MODEL_CATEGORY_OPTIONS}
          filter={selectFilter}
          autoClearSearchValue={false}
          showClear
          placeholder={t('可多选：聊天 / 图片 / 视频')}
          onChange={(value) => {
            updateRule(record.model, {
              hasCategoryOverride: true,
              categories: Array.isArray(value) ? value : [],
            });
          }}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('当前生效分类'),
      dataIndex: 'effectiveCategories',
      key: 'effectiveCategories',
      width: 200,
      render: (categories) => createTagList(categories, t('不展示')),
    },
    {
      title: t('操作'),
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type='tertiary'
          theme='borderless'
          onClick={() => resetRule(record.model)}
        >
          {t('恢复默认')}
        </Button>
      ),
    },
  ];

  const updateDragTarget = (event, category, modelName) => {
    if (dragState.category !== category || dragState.draggedModel === modelName) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const position =
      event.clientY - rect.top > rect.height / 2 ? 'after' : 'before';

    if (
      dragState.targetModel === modelName &&
      dragState.position === position
    ) {
      return;
    }

    setDragState((current) => ({
      ...current,
      targetModel: modelName,
      position,
    }));
  };

  const renderCategorySection = (section) => {
    const categoryModels =
      effectiveCollections[categoryListKeyMap[section.key]] || [];
    const rows = categoryModels
      .map((modelName) => modelRowMap.get(modelName))
      .filter(Boolean);

    const isSearchActive = Boolean(searchKeyword);
    const visibleRows = rows.filter((row) => {
      if (!isSearchActive) {
        return true;
      }
      return row.model.toLowerCase().includes(searchKeyword);
    });

    return (
      <div
        key={section.key}
        style={{
          width: '100%',
          border: '1px solid var(--semi-color-border)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Space
          align='center'
          style={{ width: '100%', justifyContent: 'space-between' }}
        >
          <Space align='center'>
            <Typography.Title heading={6} style={{ margin: 0 }}>
              {section.title}
            </Typography.Title>
            <Typography.Text type='tertiary'>
              {t('当前组内共 {{count}} 个模型', { count: rows.length })}
            </Typography.Text>
          </Space>
          <Button
            type='tertiary'
            onClick={() => rebalanceCategory(section.key)}
            disabled={rows.length === 0}
          >
            {t('重排序')}
          </Button>
        </Space>

        <Typography.Text type='tertiary' style={{ display: 'block', marginTop: 8 }}>
          {t('拖拽模型可调整顺序，序列号支持任意数字并按升序生效。')}
        </Typography.Text>

        {isSearchActive ? (
          <Typography.Text
            type='tertiary'
            style={{ display: 'block', marginTop: 6 }}
          >
            {t('搜索过滤开启时仍可拖拽，未命中的模型会保持相对顺序。')}
          </Typography.Text>
        ) : null}

        {visibleRows.length === 0 ? (
          <Typography.Text type='tertiary' style={{ display: 'block', marginTop: 16 }}>
            {t('当前分组暂无模型')}
          </Typography.Text>
        ) : (
          <div style={{ marginTop: 16 }}>
            {visibleRows.map((row, index) => {
              const isDragged =
                dragState.category === section.key &&
                dragState.draggedModel === row.model;
              const isDropTarget =
                dragState.category === section.key &&
                dragState.targetModel === row.model &&
                dragState.draggedModel &&
                dragState.draggedModel !== row.model;
              const borderStyle = isDropTarget
                ? dragState.position === 'after'
                  ? {
                      borderBottomColor: 'var(--semi-color-primary)',
                      borderBottomWidth: 2,
                    }
                  : {
                      borderTopColor: 'var(--semi-color-primary)',
                      borderTopWidth: 2,
                    }
                : {};

              return (
                <div
                  key={`${section.key}-${row.model}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', row.model);
                    setDragState({
                      category: section.key,
                      draggedModel: row.model,
                      targetModel: '',
                      position: 'before',
                    });
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    updateDragTarget(event, section.key, row.model);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const draggedModel =
                      dragState.draggedModel ||
                      event.dataTransfer.getData('text/plain');
                    const position =
                      dragState.targetModel === row.model
                        ? dragState.position
                        : 'before';
                    reorderCategoryModels(
                      section.key,
                      draggedModel,
                      row.model,
                      position,
                    );
                    setDragState({
                      category: '',
                      draggedModel: '',
                      targetModel: '',
                      position: 'before',
                    });
                  }}
                  onDragEnd={() =>
                    setDragState({
                      category: '',
                      draggedModel: '',
                      targetModel: '',
                      position: 'before',
                    })
                  }
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '56px minmax(0, 1fr) 140px',
                    gap: 12,
                    alignItems: 'center',
                    padding: '12px 10px',
                    borderTop: index === 0 ? '1px solid transparent' : '1px solid var(--semi-color-border)',
                    borderBottom: '1px solid transparent',
                    borderRadius: 8,
                    background: isDragged
                      ? 'var(--semi-color-fill-1)'
                      : 'transparent',
                    opacity: isDragged ? 0.65 : 1,
                    cursor: 'move',
                    ...borderStyle,
                  }}
                >
                  <Typography.Text type='tertiary'>
                    {t('拖拽排序')}
                  </Typography.Text>
                  <div style={{ minWidth: 0 }}>
                    <Typography.Text copyable>{row.model}</Typography.Text>
                  </div>
                  <InputNumber
                    value={row.orders?.[section.key] ?? undefined}
                    placeholder={t('留空按默认')}
                    onChange={(nextValue) => {
                      updateRule(row.model, (currentRule) => ({
                        orders: {
                          ...(currentRule.orders || {}),
                          [section.key]: normalizeOrderValue(nextValue),
                        },
                      }));
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <Spin spinning={loading || saving} size='large'>
      <Space vertical align='start' style={{ width: '100%' }} spacing='medium'>
        <Banner
          type='info'
          description={t(
            '这里配置 classic 操练场的模型分组和独立排序。覆盖分类后，模型是否出现在聊天、图片、视频分组由这里决定；三个分组的排序互不影响。',
          )}
          fullMode={false}
          closeIcon={null}
        />

        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Input
            prefix={<IconSearch />}
            value={searchText}
            showClear
            placeholder={t('搜索模型名称')}
            onChange={setSearchText}
            style={{ width: 320 }}
          />
          <Space>
            <Typography.Text type='tertiary'>
              {t('已配置 {{count}} 条操练场规则', { count: configuredRuleCount })}
            </Typography.Text>
            <Button icon={<IconRefresh />} onClick={loadData}>
              {t('刷新')}
            </Button>
            <Button theme='solid' icon={<IconSave />} onClick={handleSave}>
              {t('保存规则')}
            </Button>
          </Space>
        </Space>

        <div style={{ width: '100%' }}>
          <Typography.Title heading={6}>{t('分组设置')}</Typography.Title>
          <Typography.Text type='tertiary'>
            {t(
              '覆盖分类后，模型是否出现在某个分组由这里决定；各分组下方的排序互不影响。',
            )}
          </Typography.Text>
        </div>

        <Table
          rowKey='model'
          pagination={{ pageSize: 20 }}
          columns={classificationColumns}
          dataSource={modelRows}
          empty={t('暂无模型')}
          scroll={{ x: 1600 }}
        />

        <div style={{ width: '100%' }}>
          <Typography.Title heading={6}>{t('独立排序')}</Typography.Title>
        </div>

        <Space vertical style={{ width: '100%' }} spacing='medium'>
          {categorySections.map(renderCategorySection)}
        </Space>

        <Typography.Text type='tertiary'>
          {t('当前结果预览：聊天 {{chat}} 个，图片 {{image}} 个，视频 {{video}} 个。', {
            chat: effectiveCollections.chatModels.length,
            image: effectiveCollections.imageModels.length,
            video: effectiveCollections.videoModels.length,
          })}
        </Typography.Text>
      </Space>
    </Spin>
  );
};

export default PlaygroundModelRulesTable;
