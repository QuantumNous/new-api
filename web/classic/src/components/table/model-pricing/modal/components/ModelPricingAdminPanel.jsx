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
  Avatar,
  Banner,
  Button,
  Card,
  Input,
  InputNumber,
  Radio,
  RadioGroup,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconClose,
  IconCoinMoneyStroked,
  IconEdit,
  IconSave,
} from '@douyinfe/semi-icons';
import {
  API,
  getEffectiveModelGroupRatio,
  showError,
  showSuccess,
} from '../../../../../helpers';
import TieredPricingEditor from '../../../../../pages/Setting/Ratio/components/TieredPricingEditor';
import {
  combineBillingExpr,
  splitBillingExprAndRequestRules,
} from '../../../../../pages/Setting/Ratio/components/requestRuleExpr';

const { Text } = Typography;

const PRICE_SUFFIX = '$/1M tokens';

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatNumber = (value) => {
  const number = toNumberOrNull(value);
  if (number === null) return '';
  return Number.parseFloat(number.toFixed(12)).toString();
};

const ratioToPrice = (ratio) => {
  const number = toNumberOrNull(ratio);
  if (number === null) return '';
  return formatNumber(number * 2);
};

const deriveLanePrice = (ratio, basePrice, fallback = '') => {
  const ratioNumber = toNumberOrNull(ratio);
  const baseNumber = toNumberOrNull(basePrice);
  if (ratioNumber === null || baseNumber === null) return fallback;
  return formatNumber(ratioNumber * baseNumber);
};

const deriveRatioFromPrice = (price, basePrice) => {
  const priceNumber = toNumberOrNull(price);
  const baseNumber = toNumberOrNull(basePrice);
  if (priceNumber === null || baseNumber === null || baseNumber === 0)
    return null;
  return priceNumber / baseNumber;
};

const parseOptionalNumber = (value) => {
  const number = toNumberOrNull(value);
  return number === null ? undefined : number;
};

const NUMERIC_GROUP_FIELDS = [
  'ratio',
  'model_price',
  'prompt_price',
  'completion_price',
  'cache_price',
  'create_cache_price',
  'image_price',
  'audio_price',
  'audio_completion_price',
  'min_fee',
];

const emptyGroupDraft = () => ({
  billing_mode: '',
  billing_expr: '',
  ratio: '',
  model_price: '',
  prompt_price: '',
  completion_price: '',
  cache_price: '',
  create_cache_price: '',
  image_price: '',
  audio_price: '',
  audio_completion_price: '',
  min_fee: '',
});

const groupPricingItemToDraft = (item) => {
  const draft = emptyGroupDraft();
  if (typeof item === 'number') {
    draft.ratio = formatNumber(item);
    return draft;
  }
  if (!item || typeof item !== 'object') {
    return draft;
  }
  NUMERIC_GROUP_FIELDS.forEach((key) => {
    draft[key] = formatNumber(item[key]);
  });
  draft.billing_mode =
    typeof item.billing_mode === 'string' ? item.billing_mode : '';
  draft.billing_expr =
    typeof item.billing_expr === 'string' ? item.billing_expr : '';
  return draft;
};

const draftToGroupPricingItem = (draft, t) => {
  const item = {};
  NUMERIC_GROUP_FIELDS.forEach((key) => {
    const parsed = parseOptionalNumber(draft?.[key]);
    if (parsed === undefined) return;
    if (parsed < 0) {
      throw new Error(t('分组价格必须是不小于 0 的有效数字'));
    }
    item[key] = parsed;
  });
  const mode = (draft?.billing_mode || '').trim();
  if (mode) {
    item.billing_mode = mode;
    if (mode === 'tiered_expr') {
      const expr = (draft?.billing_expr || '').trim();
      if (!expr) {
        throw new Error(t('分组表达式计费需要填写计费表达式'));
      }
      item.billing_expr = expr;
    }
  }
  return Object.keys(item).length > 0 ? item : undefined;
};

const groupModeOptions = (t) => [
  { value: '', label: t('继承模型默认') },
  { value: 'per-token', label: t('按量计费') },
  { value: 'per-request', label: t('按次计费') },
  { value: 'tiered_expr', label: t('表达式计费') },
];

const effectiveGroupMode = (draft, modelData) => {
  if (draft.billing_mode) {
    return draft.billing_mode;
  }
  if (modelData?.billing_mode === 'tiered_expr') {
    return 'tiered_expr';
  }
  return isTokenModel(modelData) ? 'per-token' : 'per-request';
};

const fieldsForGroupMode = (mode, t) => {
  if (mode === 'per-request') {
    return [['model_price', t('模型价格'), '$/次']];
  }
  if (mode === 'tiered_expr') {
    return [];
  }
  return [
    ['ratio', t('覆盖倍率'), 'x'],
    ['prompt_price', t('输入价格'), PRICE_SUFFIX],
    ['completion_price', t('补全价格'), PRICE_SUFFIX],
    ['cache_price', t('缓存读取价格'), PRICE_SUFFIX],
    ['create_cache_price', t('缓存创建价格'), PRICE_SUFFIX],
    ['image_price', t('图片输入价格'), PRICE_SUFFIX],
    ['audio_price', t('音频输入价格'), PRICE_SUFFIX],
    ['audio_completion_price', t('音频补全价格'), PRICE_SUFFIX],
    ['min_fee', t('最低费用'), '$/次'],
  ];
};

const getAvailableGroups = (modelData, usableGroup) => {
  const modelEnableGroups = Array.isArray(modelData?.enable_groups)
    ? modelData.enable_groups
    : [];

  return Object.keys(usableGroup || {})
    .filter((group) => group && group !== 'auto')
    .filter((group) => modelEnableGroups.includes(group));
};

const isTokenModel = (modelData) => modelData?.quota_type === 0;

const buildInitialBaseForm = (modelData) => {
  const billingMode =
    modelData?.billing_mode === 'tiered_expr'
      ? 'tiered_expr'
      : modelData?.quota_type === 1
        ? 'per-request'
        : 'per-token';
  const promptPrice = ratioToPrice(modelData?.model_ratio);
  const audioInputPrice = deriveLanePrice(modelData?.audio_ratio, promptPrice);
  const splitExpr = splitBillingExprAndRequestRules(
    modelData?.billing_expr || '',
  );

  return {
    billing_mode: billingMode,
    model_price: formatNumber(modelData?.model_price),
    min_fee: formatNumber(modelData?.model_min_fee),
    prompt_price: promptPrice,
    completion_price: deriveLanePrice(modelData?.completion_ratio, promptPrice),
    cache_price: deriveLanePrice(modelData?.cache_ratio, promptPrice),
    create_cache_price: deriveLanePrice(
      modelData?.create_cache_ratio,
      promptPrice,
    ),
    image_price: deriveLanePrice(modelData?.image_ratio, promptPrice),
    audio_price: audioInputPrice,
    audio_completion_price: deriveLanePrice(
      modelData?.audio_completion_ratio,
      audioInputPrice,
    ),
    billing_expr: splitExpr.billingExpr,
    request_rule_expr: splitExpr.requestRuleExpr,
  };
};

const buildBasePayload = (modelData, baseForm, t) => {
  if (baseForm.billing_mode === 'per-request') {
    const modelPrice = toNumberOrNull(baseForm.model_price);
    if (modelPrice === null) {
      throw new Error(t('按次计费需要填写模型价格'));
    }
    return {
      billing_mode: 'per-request',
      model_price: modelPrice,
    };
  }

  if (baseForm.billing_mode === 'tiered_expr') {
    const billingExpr = combineBillingExpr(
      baseForm.billing_expr || '',
      baseForm.request_rule_expr || '',
    );
    if (!billingExpr.trim()) {
      throw new Error(t('表达式计费需要填写计费表达式'));
    }
    return {
      billing_mode: 'tiered_expr',
      billing_expr: billingExpr,
    };
  }

  const promptPrice = toNumberOrNull(baseForm.prompt_price);
  if (promptPrice === null) {
    throw new Error(t('按量计费需要填写输入价格'));
  }

  const audioPrice = toNumberOrNull(baseForm.audio_price);
  const audioOutputPrice = toNumberOrNull(baseForm.audio_completion_price);
  if (audioOutputPrice !== null && (audioPrice === null || audioPrice === 0)) {
    throw new Error(t('填写音频补全价格前，需要先填写音频输入价格。'));
  }

  return {
    billing_mode: 'per-token',
    model_ratio: promptPrice / 2,
    completion_ratio: parseOptionalNumber(
      deriveRatioFromPrice(baseForm.completion_price, baseForm.prompt_price),
    ),
    cache_ratio: parseOptionalNumber(
      deriveRatioFromPrice(baseForm.cache_price, baseForm.prompt_price),
    ),
    create_cache_ratio: parseOptionalNumber(
      deriveRatioFromPrice(baseForm.create_cache_price, baseForm.prompt_price),
    ),
    image_ratio: parseOptionalNumber(
      deriveRatioFromPrice(baseForm.image_price, baseForm.prompt_price),
    ),
    audio_ratio: parseOptionalNumber(
      deriveRatioFromPrice(baseForm.audio_price, baseForm.prompt_price),
    ),
    audio_completion_ratio: parseOptionalNumber(
      deriveRatioFromPrice(
        baseForm.audio_completion_price,
        baseForm.audio_price,
      ),
    ),
    min_fee: parseOptionalNumber(baseForm.min_fee),
  };
};

const requestOk = (res) => res?.data?.success;

export default function ModelPricingAdminPanel({
  modelData,
  groupRatio,
  usableGroup,
  onSaved,
  t,
}) {
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('base');
  const [baseForm, setBaseForm] = useState(() =>
    buildInitialBaseForm(modelData),
  );
  const [groupDrafts, setGroupDrafts] = useState({});
  const [savingBase, setSavingBase] = useState(false);
  const [savingGroups, setSavingGroups] = useState(false);

  const availableGroups = useMemo(
    () => getAvailableGroups(modelData, usableGroup),
    [modelData, usableGroup],
  );

  useEffect(() => {
    setBaseForm(buildInitialBaseForm(modelData));
    const nextDrafts = {};
    availableGroups.forEach((group) => {
      nextDrafts[group] = groupPricingItemToDraft(
        modelData?.group_pricing?.[group],
      );
    });
    setGroupDrafts(nextDrafts);
  }, [modelData, availableGroups]);

  if (!modelData) return null;

  const updateBaseForm = (field, value) => {
    setBaseForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveBase = async () => {
    setSavingBase(true);
    try {
      const payload = buildBasePayload(modelData, baseForm, t);
      const url = modelData.id
        ? `/api/models/${modelData.id}/pricing`
        : '/api/models/pricing_by_name';
      const body = modelData.id
        ? payload
        : { ...payload, model_name: modelData.model_name };
      const res = await API.put(url, body);
      if (!requestOk(res)) {
        showError(res?.data?.message || t('保存失败'));
        return;
      }
      showSuccess(t('保存成功'));
      setEditing(false);
      onSaved?.();
    } catch (error) {
      showError(error.message || error);
    } finally {
      setSavingBase(false);
    }
  };

  const handleSaveGroups = async () => {
    const groupPricing = {};
    try {
      for (const [group, draft] of Object.entries(groupDrafts)) {
        const item = draftToGroupPricingItem(draft, t);
        if (item !== undefined) {
          groupPricing[group] = item;
        }
      }
    } catch (error) {
      showError(error.message || error);
      return;
    }

    setSavingGroups(true);
    try {
      const url = modelData.id
        ? `/api/models/${modelData.id}/group_pricing`
        : '/api/models/group_pricing_by_name';
      const body = modelData.id
        ? { group_pricing: groupPricing }
        : { model_name: modelData.model_name, group_pricing: groupPricing };
      const res = await API.put(url, body);
      if (!requestOk(res)) {
        showError(res?.data?.message || t('保存失败'));
        return;
      }
      showSuccess(t('保存成功'));
      setEditing(false);
      onSaved?.();
    } catch (error) {
      showError(error.message || error);
    } finally {
      setSavingGroups(false);
    }
  };

  const groupData = availableGroups.map((group) => ({
    key: group,
    group,
    defaultRatio: groupRatio?.[group] ?? 1,
    effectiveRatio: getEffectiveModelGroupRatio(modelData, group, groupRatio),
  }));

  const updateGroupDraft = (group, field, value) => {
    setGroupDrafts((current) => ({
      ...current,
      [group]: {
        ...(current[group] || emptyGroupDraft()),
        [field]: value,
      },
    }));
  };

  return (
    <div>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center'>
          <Avatar size='small' color='blue' className='mr-2 shadow-md'>
            <IconCoinMoneyStroked size={16} />
          </Avatar>
          <div>
            <Text className='text-lg font-medium'>{t('管理员定价')}</Text>
            <div className='text-xs text-gray-600'>
              {t('直接修改当前模型的基础价格和分组覆盖倍率')}
            </div>
          </div>
        </div>
        {editing ? (
          <Button
            size='small'
            icon={<IconClose />}
            onClick={() => {
              setBaseForm(buildInitialBaseForm(modelData));
              setEditing(false);
            }}
          >
            {t('取消')}
          </Button>
        ) : (
          <Button
            size='small'
            icon={<IconEdit />}
            onClick={() => setEditing(true)}
          >
            {t('编辑')}
          </Button>
        )}
      </div>

      <Card bodyStyle={{ padding: 12 }} className='!rounded-lg'>
        <RadioGroup
          type='button'
          size='small'
          value={activeTab}
          onChange={(event) => setActiveTab(event.target.value)}
          style={{ marginBottom: 12 }}
        >
          <Radio value='base'>{t('基础价格')}</Radio>
          <Radio value='groups'>{t('分组覆盖')}</Radio>
        </RadioGroup>

        {activeTab === 'base' ? (
          <div>
            {editing && (
              <RadioGroup
                type='button'
                size='small'
                value={baseForm.billing_mode}
                onChange={(event) =>
                  updateBaseForm('billing_mode', event.target.value)
                }
                style={{ marginBottom: 12 }}
              >
                <Radio value='per-token'>{t('按量计费')}</Radio>
                <Radio value='per-request'>{t('按次计费')}</Radio>
                <Radio value='tiered_expr'>{t('表达式计费')}</Radio>
              </RadioGroup>
            )}

            {baseForm.billing_mode === 'tiered_expr' ? (
              editing ? (
                <TieredPricingEditor
                  model={{
                    name: modelData.model_name,
                    billingExpr: baseForm.billing_expr,
                  }}
                  requestRuleExpr={baseForm.request_rule_expr}
                  onExprChange={(value) =>
                    updateBaseForm('billing_expr', value)
                  }
                  onRequestRuleExprChange={(value) =>
                    updateBaseForm('request_rule_expr', value)
                  }
                  t={t}
                />
              ) : (
                <TextArea
                  readonly
                  value={
                    combineBillingExpr(
                      baseForm.billing_expr,
                      baseForm.request_rule_expr,
                    ) || ''
                  }
                  autosize={{ minRows: 3, maxRows: 8 }}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              )
            ) : baseForm.billing_mode === 'per-request' ? (
              <div>
                <Text size='small' type='secondary'>
                  {t('模型价格')} ({t('美元')}/{t('次')})
                </Text>
                <InputNumber
                  value={toNumberOrNull(baseForm.model_price)}
                  min={0}
                  disabled={!editing}
                  onChange={(value) =>
                    updateBaseForm('model_price', formatNumber(value))
                  }
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                {[
                  ['prompt_price', '输入价格'],
                  ['completion_price', '补全价格'],
                  ['cache_price', '缓存读取价格'],
                  ['create_cache_price', '缓存创建价格'],
                  ['image_price', '图片输入价格'],
                  ['audio_price', '音频输入价格'],
                  ['audio_completion_price', '音频补全价格'],
                  ['min_fee', '最低费用'],
                ].map(([field, label]) => (
                  <div key={field}>
                    <Text size='small' type='secondary'>
                      {t(label)}
                    </Text>
                    <InputNumber
                      value={toNumberOrNull(baseForm[field])}
                      min={0}
                      disabled={!editing}
                      suffix={field === 'min_fee' ? '$/次' : PRICE_SUFFIX}
                      onChange={(value) =>
                        updateBaseForm(field, formatNumber(value))
                      }
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                ))}
              </div>
            )}

            {!isTokenModel(modelData) &&
              baseForm.billing_mode === 'per-token' && (
                <Banner
                  type='warning'
                  fullMode={false}
                  closeIcon={null}
                  description={t(
                    '当前模型原本是按次计费，保存后会切换为按量计费。',
                  )}
                  style={{ marginTop: 12 }}
                />
              )}

            {editing && (
              <div className='flex justify-end mt-4'>
                <Button
                  type='primary'
                  theme='solid'
                  icon={<IconSave />}
                  loading={savingBase}
                  onClick={handleSaveBase}
                >
                  {t('保存基础价格')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <Banner
              type='info'
              fullMode={false}
              closeIcon={null}
              description={t(
                '单项价格留空则继续按倍率计算；填写后表示该模型在该分组下的最终美元价格。',
              )}
              style={{ marginBottom: 12 }}
            />
            <div className='space-y-3'>
              {groupData.map((row) => {
                const draft = groupDrafts[row.group] || emptyGroupDraft();
                return (
                  <Card
                    key={row.group}
                    bodyStyle={{ padding: 12 }}
                    className='!rounded-lg'
                    style={{ marginBottom: 12 }}
                  >
                    <div className='flex items-center justify-between mb-3'>
                      <Text strong>{row.group}</Text>
                      <Text size='small' type='secondary'>
                        {t('默认倍率')} {row.defaultRatio}x / {t('当前倍率')}{' '}
                        {row.effectiveRatio}x
                      </Text>
                    </div>
                    {(() => {
                      const groupMode = effectiveGroupMode(draft, modelData);
                      const fields = fieldsForGroupMode(groupMode, t);
                      const modeOptions = groupModeOptions(t);
                      const currentModeLabel =
                        modeOptions.find(
                          (opt) => opt.value === draft.billing_mode,
                        )?.label || t('继承模型默认');
                      return (
                        <div className='space-y-3'>
                          <div>
                            <Text
                              size='small'
                              type='secondary'
                              style={{ display: 'block', marginBottom: 4 }}
                            >
                              {t('分组计费模式')}
                            </Text>
                            {editing ? (
                              <RadioGroup
                                type='button'
                                size='small'
                                value={draft.billing_mode}
                                onChange={(event) =>
                                  updateGroupDraft(
                                    row.group,
                                    'billing_mode',
                                    event.target.value,
                                  )
                                }
                              >
                                {modeOptions.map((opt) => (
                                  <Radio key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </Radio>
                                ))}
                              </RadioGroup>
                            ) : (
                              <div className='font-mono mt-1'>
                                {currentModeLabel}
                              </div>
                            )}
                          </div>

                          {groupMode === 'tiered_expr' ? (
                            <div>
                              <Text
                                size='small'
                                type='secondary'
                                style={{ display: 'block', marginBottom: 4 }}
                              >
                                {t('计费表达式')}
                              </Text>
                              {editing ? (
                                <TextArea
                                  value={draft.billing_expr ?? ''}
                                  placeholder={'tier("base", p * 2 + c * 8)'}
                                  autosize={{ minRows: 3, maxRows: 8 }}
                                  style={{
                                    fontFamily: 'monospace',
                                    fontSize: 12,
                                  }}
                                  onChange={(value) =>
                                    updateGroupDraft(
                                      row.group,
                                      'billing_expr',
                                      value,
                                    )
                                  }
                                />
                              ) : (
                                <div className='font-mono mt-1'>
                                  {draft.billing_expr || '-'}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                              {fields.map(([field, label, suffix]) => (
                                <div key={field}>
                                  <Text size='small' type='secondary'>
                                    {label}
                                  </Text>
                                  {editing ? (
                                    <Input
                                      value={draft[field] ?? ''}
                                      placeholder={suffix}
                                      suffix={suffix}
                                      onChange={(value) =>
                                        updateGroupDraft(
                                          row.group,
                                          field,
                                          value,
                                        )
                                      }
                                      style={{ marginTop: 4 }}
                                    />
                                  ) : (
                                    <div className='font-mono mt-1'>
                                      {draft[field] || '-'}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </Card>
                );
              })}
            </div>
            {editing && (
              <>
                <Text
                  type='secondary'
                  size='small'
                  style={{ display: 'block', marginTop: 8 }}
                >
                  {t(
                    '留空表示使用默认分组倍率。覆盖倍率是最终倍率，不会再叠加默认倍率。',
                  )}
                </Text>
                <div className='flex justify-end mt-4'>
                  <Button
                    type='primary'
                    theme='solid'
                    icon={<IconSave />}
                    loading={savingGroups}
                    onClick={handleSaveGroups}
                  >
                    {t('保存分组覆盖')}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
