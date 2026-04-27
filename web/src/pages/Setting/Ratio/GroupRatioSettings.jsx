/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Spinner, Switch } from '@heroui/react';
import { ChevronDown, HelpCircle, X } from 'lucide-react';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import GroupTable from './components/GroupTable';
import AutoGroupList from './components/AutoGroupList';
import GroupGroupRatioRules from './components/GroupGroupRatioRules';
import GroupSpecialUsableRules from './components/GroupSpecialUsableRules';

// ----------------------------- helpers -----------------------------

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

const textareaClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition focus:border-primary';

function FieldLabel({ children }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
    </label>
  );
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className='mt-1.5 text-xs text-muted'>{children}</div>;
}

function FieldError({ children }) {
  if (!children) return null;
  return <div className='mt-1 text-xs text-danger'>{children}</div>;
}

function SectionHeader({ title }) {
  if (!title) return null;
  return (
    <div className='border-b border-border pb-2 text-base font-semibold text-foreground'>
      {title}
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre className='my-2 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-surface-secondary px-3.5 py-2.5 font-mono text-[13px] leading-7 text-foreground'>
      {children}
    </pre>
  );
}

function GuideSection({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className='mt-4'>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='inline-flex items-center gap-1 px-0 py-1 text-sm font-medium text-primary hover:underline'
      >
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
        <span>{title}</span>
      </button>
      {open && (
        <div className='mt-2 rounded-md bg-surface-secondary p-3'>
          {children}
        </div>
      )}
    </div>
  );
}

const OPTION_KEYS = [
  'GroupRatio',
  'UserUsableGroups',
  'GroupGroupRatio',
  'group_ratio_setting.group_special_usable_group',
  'AutoGroups',
  'DefaultUseAutoGroup',
];

function parseJSONSafe(str, fallback) {
  if (!str || !str.trim()) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Validation helpers (replace Semi `<Form.TextArea rules>`)
const validateJSON = (value) => !value || verifyJSON(value);
const validateAutoGroups = (value) => {
  if (!value || value.trim() === '') return true;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return false;
    return parsed.every((item) => typeof item === 'string');
  } catch {
    return false;
  }
};

// ----------------------------- main -----------------------------

const INITIAL_INPUTS = {
  GroupRatio: '',
  UserUsableGroups: '',
  GroupGroupRatio: '',
  'group_ratio_setting.group_special_usable_group': '',
  AutoGroups: '',
  DefaultUseAutoGroup: false,
};

export default function GroupRatioSettings(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState('visual');
  const [showGuide, setShowGuide] = useState(false);
  const [guideTab, setGuideTab] = useState('overview');

  const [inputs, setInputs] = useState(INITIAL_INPUTS);
  const [inputsRow, setInputsRow] = useState(INITIAL_INPUTS);
  const [errors, setErrors] = useState({});
  const dataVersionRef = useRef(0);

  const groupNames = useMemo(() => {
    const ratioMap = parseJSONSafe(inputs.GroupRatio, {});
    return Object.keys(ratioMap);
  }, [inputs.GroupRatio]);

  const setField = (key) => (value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validateManual = () => {
    const next = {};
    if (!validateJSON(inputs.GroupRatio)) {
      next.GroupRatio = t('不是合法的 JSON 字符串');
    }
    if (!validateJSON(inputs.UserUsableGroups)) {
      next.UserUsableGroups = t('不是合法的 JSON 字符串');
    }
    if (!validateJSON(inputs.GroupGroupRatio)) {
      next.GroupGroupRatio = t('不是合法的 JSON 字符串');
    }
    if (
      !validateJSON(inputs['group_ratio_setting.group_special_usable_group'])
    ) {
      next['group_ratio_setting.group_special_usable_group'] = t(
        '不是合法的 JSON 字符串',
      );
    }
    if (!validateAutoGroups(inputs.AutoGroups)) {
      next.AutoGroups = t(
        '必须是有效的 JSON 字符串数组，例如：["g1","g2"]',
      );
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  async function onSubmit() {
    if (editMode === 'manual' && !validateManual()) {
      showError(t('请检查输入'));
      return;
    }

    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) {
      return showWarning(t('你似乎并没有修改什么'));
    }

    const requestQueue = updateArray.map((item) => {
      const value =
        typeof inputs[item.key] === 'boolean'
          ? String(inputs[item.key])
          : inputs[item.key];
      return API.put('/api/option/', { key: item.key, value });
    });

    setLoading(true);
    try {
      const res = await Promise.all(requestQueue);
      if (res.includes(undefined)) {
        return showError(
          requestQueue.length > 1 ? t('部分保存失败，请重试') : t('保存失败'),
        );
      }
      for (let i = 0; i < res.length; i++) {
        if (!res[i].data.success) {
          return showError(res[i].data.message);
        }
      }
      showSuccess(t('保存成功'));
      props.refresh();
    } catch (error) {
      console.error('Unexpected error:', error);
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentInputs = {};
    for (const key in props.options) {
      if (OPTION_KEYS.includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs((prev) => ({ ...prev, ...currentInputs }));
    setInputsRow({ ...INITIAL_INPUTS, ...structuredClone(currentInputs) });
    dataVersionRef.current += 1;
  }, [props.options]);

  // ESC-to-close guide
  useEffect(() => {
    if (!showGuide) return;
    const onKey = (event) => {
      if (event.key === 'Escape') setShowGuide(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showGuide]);

  const handleGroupTableChange = useCallback(
    ({ GroupRatio, UserUsableGroups }) => {
      setInputs((prev) => ({ ...prev, GroupRatio, UserUsableGroups }));
    },
    [],
  );

  const handleAutoGroupsChange = useCallback((value) => {
    setInputs((prev) => ({ ...prev, AutoGroups: value }));
  }, []);

  const handleGroupGroupRatioChange = useCallback((value) => {
    setInputs((prev) => ({ ...prev, GroupGroupRatio: value }));
  }, []);

  const handleSpecialUsableChange = useCallback((value) => {
    setInputs((prev) => ({
      ...prev,
      'group_ratio_setting.group_special_usable_group': value,
    }));
  }, []);

  const dv = dataVersionRef.current;

  // ---------- Visual mode ---------- //
  const renderVisualMode = () => (
    <div className='space-y-6'>
      <div className='space-y-3'>
        <SectionHeader title={t('分组管理')} />
        <div className='text-xs text-muted'>
          {t('倍率用于计费乘数，勾选「用户可选」后用户可在创建令牌时选择该分组')}
        </div>
        <GroupTable
          key={`gt_${dv}`}
          groupRatio={inputs.GroupRatio}
          userUsableGroups={inputs.UserUsableGroups}
          onChange={handleGroupTableChange}
        />
      </div>

      <div className='space-y-3'>
        <SectionHeader title={t('自动分组')} />
        <div className='text-xs text-muted'>
          {t(
            '令牌分组设为 auto 时，按以下顺序依次尝试选择可用分组，排在前面的优先级更高',
          )}
        </div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'>
          <div className='space-y-2'>
            <FieldLabel>{t('默认使用auto分组')}</FieldLabel>
            <div className='flex items-center gap-2'>
              <Switch
                isSelected={!!inputs.DefaultUseAutoGroup}
                onValueChange={(value) =>
                  setInputs((prev) => ({
                    ...prev,
                    DefaultUseAutoGroup: value,
                  }))
                }
                size='md'
                aria-label={t('默认使用auto分组')}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
            <FieldHint>
              {t('开启后创建令牌默认选择auto分组，初始令牌也将设为auto')}
            </FieldHint>
          </div>
        </div>
        <AutoGroupList
          key={`ag_${dv}`}
          value={inputs.AutoGroups}
          groupNames={groupNames}
          onChange={handleAutoGroupsChange}
        />
      </div>

      <div className='space-y-3'>
        <SectionHeader title={t('分组特殊倍率')} />
        <div className='text-xs text-muted'>
          {t(
            '当某个分组的用户使用另一个分组的令牌时，可设置特殊倍率覆盖基础倍率。例如：vip 分组的用户使用 default 分组时倍率为 0.5',
          )}
        </div>
        <GroupGroupRatioRules
          key={`ggr_${dv}`}
          value={inputs.GroupGroupRatio}
          groupNames={groupNames}
          onChange={handleGroupGroupRatioChange}
        />
      </div>

      <div className='space-y-3'>
        <SectionHeader title={t('分组特殊可用分组')} />
        <div className='text-xs text-muted'>
          {t(
            '为特定用户分组配置可用分组的增减规则。「添加」为该分组新增可用分组，「移除」移除默认可用分组，「追加」直接追加分组',
          )}
        </div>
        <GroupSpecialUsableRules
          key={`gsu_${dv}`}
          value={inputs['group_ratio_setting.group_special_usable_group']}
          groupNames={groupNames}
          onChange={handleSpecialUsableChange}
        />
      </div>
    </div>
  );

  // ---------- Manual mode ---------- //
  const renderManualMode = () => (
    <div className='space-y-4'>
      <SectionHeader title={t('分组JSON设置')} />

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
        <div className='space-y-2 sm:col-span-2'>
          <FieldLabel>{t('分组倍率')}</FieldLabel>
          <textarea
            rows={6}
            value={inputs.GroupRatio || ''}
            onChange={(event) => setField('GroupRatio')(event.target.value)}
            placeholder={t('为一个 JSON 文本，键为分组名称，值为倍率')}
            className={textareaClass}
          />
          <FieldError>{errors.GroupRatio}</FieldError>
          <FieldHint>
            {t(
              '分组倍率设置，可以在此处新增分组或修改现有分组的倍率，格式为 JSON 字符串，例如：{"vip": 0.5, "test": 1}，表示 vip 分组的倍率为 0.5，test 分组的倍率为 1',
            )}
          </FieldHint>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
        <div className='space-y-2 sm:col-span-2'>
          <FieldLabel>{t('用户可选分组')}</FieldLabel>
          <textarea
            rows={6}
            value={inputs.UserUsableGroups || ''}
            onChange={(event) =>
              setField('UserUsableGroups')(event.target.value)
            }
            placeholder={t('为一个 JSON 文本，键为分组名称，值为分组描述')}
            className={textareaClass}
          />
          <FieldError>{errors.UserUsableGroups}</FieldError>
          <FieldHint>
            {t(
              '用户新建令牌时可选的分组，格式为 JSON 字符串，例如：{"vip": "VIP 用户", "test": "测试"}，表示用户可以选择 vip 分组和 test 分组',
            )}
          </FieldHint>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
        <div className='space-y-2 sm:col-span-2'>
          <FieldLabel>{t('分组特殊倍率')}</FieldLabel>
          <textarea
            rows={6}
            value={inputs.GroupGroupRatio || ''}
            onChange={(event) =>
              setField('GroupGroupRatio')(event.target.value)
            }
            placeholder={t('为一个 JSON 文本')}
            className={textareaClass}
          />
          <FieldError>{errors.GroupGroupRatio}</FieldError>
          <FieldHint>
            {t(
              '键为分组名称，值为另一个 JSON 对象，键为分组名称，值为该分组的用户的特殊分组倍率，例如：{"vip": {"default": 0.5, "test": 1}}，表示 vip 分组的用户在使用default分组的令牌时倍率为0.5，使用test分组时倍率为1',
            )}
          </FieldHint>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
        <div className='space-y-2 sm:col-span-2'>
          <FieldLabel>{t('分组特殊可用分组')}</FieldLabel>
          <textarea
            rows={6}
            value={
              inputs['group_ratio_setting.group_special_usable_group'] || ''
            }
            onChange={(event) =>
              setField('group_ratio_setting.group_special_usable_group')(
                event.target.value,
              )
            }
            placeholder={t('为一个 JSON 文本')}
            className={textareaClass}
          />
          <FieldError>
            {errors['group_ratio_setting.group_special_usable_group']}
          </FieldError>
          <FieldHint>
            {t(
              '键为用户分组名称，值为操作映射对象。内层键以"+:"开头表示添加指定分组（键值为分组名称，值为描述），以"-:"开头表示移除指定分组（键值为分组名称），不带前缀的键直接添加该分组。例如：{"vip": {"+:premium": "高级分组", "special": "特殊分组", "-:default": "默认分组"}}，表示 vip 分组的用户可以使用 premium 和 special 分组，同时移除 default 分组的访问权限',
            )}
          </FieldHint>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
        <div className='space-y-2 sm:col-span-2'>
          <FieldLabel>{t('自动分组auto，从第一个开始选择')}</FieldLabel>
          <textarea
            rows={6}
            value={inputs.AutoGroups || ''}
            onChange={(event) => setField('AutoGroups')(event.target.value)}
            placeholder={t('为一个 JSON 文本')}
            className={textareaClass}
          />
          <FieldError>{errors.AutoGroups}</FieldError>
        </div>
      </div>

      <div className='space-y-2'>
        <FieldLabel>
          {t(
            '创建令牌默认选择auto分组，初始令牌也将设为auto（否则留空，为用户默认分组）',
          )}
        </FieldLabel>
        <Switch
          isSelected={!!inputs.DefaultUseAutoGroup}
          onValueChange={(value) =>
            setInputs((prev) => ({ ...prev, DefaultUseAutoGroup: value }))
          }
          size='md'
          aria-label={t('默认使用auto分组')}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </div>
    </div>
  );

  // ---------- Guide drawer ---------- //
  const guideTabs = [
    { key: 'overview', label: t('概览') },
    { key: 'groups', label: t('分组管理') },
    { key: 'auto', label: t('自动分组') },
    { key: 'ratios', label: t('特殊倍率') },
    { key: 'usable', label: t('可用分组') },
  ];

  const renderGuide = () => (
    <>
      <div
        aria-hidden={!showGuide}
        onClick={() => setShowGuide(false)}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          showGuide ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role='dialog'
        aria-modal='true'
        aria-hidden={!showGuide}
        style={{ width: 560 }}
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-full flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          showGuide ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className='flex items-center justify-between gap-3 border-b border-border px-5 py-3'>
          <h4 className='m-0 text-lg font-semibold text-foreground'>
            {t('分组设置使用说明')}
          </h4>
          <Button
            isIconOnly
            variant='light'
            size='sm'
            aria-label={t('关闭')}
            onPress={() => setShowGuide(false)}
          >
            <X size={16} />
          </Button>
        </header>

        <div className='flex border-b border-border'>
          {guideTabs.map((tab) => {
            const active = tab.key === guideTab;
            return (
              <button
                key={tab.key}
                type='button'
                onClick={() => setGuideTab(tab.key)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className='flex-1 overflow-auto px-6 pb-6'>
          {guideTab === 'overview' && (
            <div className='pt-5'>
              <h5 className='m-0 mb-3 text-base font-semibold text-foreground'>
                {t('什么是分组？')}
              </h5>
              <p className='mb-2 text-sm leading-7 text-foreground'>
                {t(
                  '分组是用于控制计费倍率和模型访问权限的核心概念。每个用户属于一个分组，每个令牌也可以指定使用某个分组。',
                )}
              </p>
              <p className='text-sm leading-7 text-foreground'>
                {t(
                  '通过分组可以实现不同用户等级的差异化定价，例如 VIP 用户享受更低的 API 调用费用。',
                )}
              </p>

              <GuideSection title={t('核心概念')}>
                <p className='leading-7'>
                  <strong>{t('用户分组')}</strong>{' — '}
                  {t('由管理员分配，决定用户身份等级（如 default、vip）。')}
                </p>
                <p className='mt-1 leading-7'>
                  <strong>{t('令牌分组')}</strong>{' — '}
                  {t(
                    '用户创建令牌时选择的分组，决定该令牌的实际计费倍率。一个用户可以创建多个令牌，使用不同分组。',
                  )}
                </p>
                <p className='mt-1 leading-7'>
                  <strong>{t('倍率')}</strong>{' — '}
                  {t('计费乘数，倍率越低费用越低。例如倍率 0.5 表示半价。')}
                </p>
                <p className='mt-1 leading-7'>
                  <strong>{t('用户可选')}</strong>{' — '}
                  {t(
                    '勾选后，该分组会出现在用户创建令牌时的下拉菜单中。未勾选的分组只能由管理员分配，用户自己无法选择。',
                  )}
                </p>
                <p className='mt-1 leading-7'>
                  <strong>{t('自动分组')}</strong>{' — '}
                  {t(
                    '令牌分组设为 auto 时，系统按优先级顺序自动选择一个可用分组。',
                  )}
                </p>
              </GuideSection>
            </div>
          )}

          {guideTab === 'groups' && (
            <div className='pt-5'>
              <h5 className='m-0 mb-3 text-base font-semibold text-foreground'>
                {t('创建和管理分组')}
              </h5>
              <p className='mb-2 text-sm leading-7 text-foreground'>
                {t(
                  '每个分组代表一个价格档位。管理员创建分组后，可以选择哪些档位对用户开放自选。',
                )}
              </p>

              <GuideSection title={t('查看示例')}>
                <p className='mb-2 text-xs text-muted'>
                  {t('场景：站点提供两个价格档位，用户可以按需选择')}
                </p>
                <CodeBlock>
                  {`${t('分组名')}      ${t('倍率')}    ${t('用户可选')}    ${t('说明')}\n──────────────────────────────────────\nstandard  1.0     ${t('是')}        ${t('标准价格')}\npremium   0.5     ${t('是')}        ${t('高级套餐，半价优惠')}`}
                </CodeBlock>
                <p className='mt-2 text-xs leading-7'>
                  {t('两个分组都勾选了「用户可选」，所以用户创建令牌时可以看到这两个选项：')}
                </p>
                <CodeBlock>
                  {t('用户创建令牌 → 选择分组下拉框：')}
                  {'\n'}
                  {`  ├─ standard (${t('标准价格')})`}
                  {'\n'}
                  {`  └─ premium  (${t('高级套餐，半价优惠')})`}
                </CodeBlock>
                <p className='mt-2 text-xs leading-7'>
                  {t('选择 premium 创建的令牌，调用 API 时费用为 standard 的 50%。')}
                </p>
                <p className='mt-3 text-xs leading-7'>
                  <strong>{t('对比：不勾选「用户可选」的场景')}</strong>
                </p>
                <p className='mt-1 text-xs leading-7'>
                  {t('假设再加两个分组 default 和 vip，但不勾选用户可选：')}
                </p>
                <CodeBlock>
                  {`${t('分组名')}      ${t('倍率')}    ${t('用户可选')}    ${t('说明')}\n──────────────────────────────────────\ndefault   1.0     ${t('否')}        ${t('管理员分配的基础分组')}\nvip       0.5     ${t('否')}        ${t('管理员分配的优惠分组')}\nstandard  1.0     ${t('是')}        ${t('标准价格')}\npremium   0.5     ${t('是')}        ${t('高级套餐，半价优惠')}`}
                </CodeBlock>
                <p className='mt-2 text-xs leading-7'>
                  {t('此时用户创建令牌时只能看到 standard 和 premium：')}
                </p>
                <CodeBlock>
                  {t('用户创建令牌 → 选择分组下拉框：')}
                  {'\n'}
                  {`  ├─ standard (${t('标准价格')})`}
                  {'\n'}
                  {`  └─ premium  (${t('高级套餐，半价优惠')})`}
                  {'\n\n'}
                  {`  ${t('不会出现')} default ${t('和')} vip`}
                </CodeBlock>
                <p className='mt-2 text-xs leading-7'>
                  {t(
                    'default 和 vip 只能由管理员在「用户管理」中分配给用户。适用于按用户等级定价、内部测试等不希望用户自主选择的场景。',
                  )}
                </p>
                <p className='mt-3 text-xs leading-7'>
                  <strong>{t('用户分组的联动作用')}</strong>
                </p>
                <p className='text-xs leading-7'>
                  {t('管理员给用户分配的分组（如 vip）不仅决定用户身份，还会影响后续两个功能：')}
                </p>
                <p className='mt-1 text-xs leading-7'>
                  {'1. '}
                  <strong>{t('特殊倍率')}</strong>{' — '}
                  {t(
                    '可以根据用户分组设置不同的计费倍率。例如 vip 用户使用 standard 令牌时倍率从 1.0 降为 0.8。',
                  )}
                </p>
                <p className='mt-0.5 text-xs leading-7'>
                  {'2. '}
                  <strong>{t('可用分组')}</strong>{' — '}
                  {t(
                    '可以根据用户分组增减令牌可选的分组范围。例如 vip 用户额外开放 premium 分组，或移除某个分组的选择权。',
                  )}
                </p>
                <p className='mt-1.5 text-xs leading-7 text-muted'>
                  {t('详见「特殊倍率」和「可用分组」标签页。')}
                </p>
              </GuideSection>

              <GuideSection title={t('JSON 格式参考')}>
                <p className='mb-1 text-xs'>
                  <strong>
                    <code className='font-mono'>GroupRatio</code>
                  </strong>
                  {' — '}
                  {t('分组名称到倍率的映射')}
                </p>
                <CodeBlock>
                  {`{"default": 1, "vip": 0.5, "standard": 1, "premium": 0.5}`}
                </CodeBlock>
                <p className='mb-1 mt-2 text-xs'>
                  <strong>
                    <code className='font-mono'>UserUsableGroups</code>
                  </strong>
                  {' — '}
                  {t('用户可选分组的名称和描述（只包含勾选了用户可选的分组）')}
                </p>
                <CodeBlock>
                  {`{"standard": "${t('标准价格')}", "premium": "${t('高级套餐，半价优惠')}"}`}
                </CodeBlock>
              </GuideSection>
            </div>
          )}

          {guideTab === 'auto' && (
            <div className='pt-5'>
              <h5 className='m-0 mb-3 text-base font-semibold text-foreground'>
                {t('自动分组选择')}
              </h5>
              <p className='text-sm leading-7 text-foreground'>
                {t(
                  '当令牌分组设为 auto 时，系统按列表顺序依次选择可用分组。排在前面的优先级更高。',
                )}
              </p>

              <GuideSection title={t('查看示例')}>
                <p className='mb-1.5 text-xs text-muted'>
                  {t('场景：设置自动选择优先级')}
                </p>
                <CodeBlock>
                  {`1. default    ${t('最高优先级')}\n2. vip`}
                </CodeBlock>
                <p className='mt-1.5 text-xs leading-6'>
                  {t('开启「默认使用 auto 分组」后，新建令牌和初始令牌都会自动设为 auto。')}
                </p>
              </GuideSection>

              <GuideSection title={t('JSON 格式参考')}>
                <p className='mb-1 text-xs'>
                  <strong>
                    <code className='font-mono'>AutoGroups</code>
                  </strong>
                  {' — '}
                  {t('有序字符串数组')}
                </p>
                <CodeBlock>{`["default", "vip"]`}</CodeBlock>
              </GuideSection>
            </div>
          )}

          {guideTab === 'ratios' && (
            <div className='pt-5'>
              <h5 className='m-0 mb-3 text-base font-semibold text-foreground'>
                {t('跨分组特殊倍率')}
              </h5>
              <p className='mb-2 text-sm leading-7 text-foreground'>
                {t(
                  '正常情况下，令牌的计费倍率由令牌所选的分组决定。特殊倍率可以根据「用户所在分组」进一步覆盖这个倍率。',
                )}
              </p>
              <p className='text-sm leading-7 text-foreground'>
                {t('简单来说：同一个令牌分组，不同等级的用户可以享受不同的价格。')}
              </p>

              <GuideSection title={t('查看示例')}>
                <p className='mb-2 text-xs text-muted'>
                  {t(
                    '场景：站点有 standard（倍率 1.0）和 premium（倍率 0.5）两个分组，希望 vip 用户使用 standard 令牌时也能享受折扣',
                  )}
                </p>
                <p className='mb-2 text-xs leading-7'>
                  <strong>{t('不配置特殊倍率时：')}</strong>
                </p>
                <CodeBlock>
                  {`${t('普通用户')} + standard ${t('令牌')} → ${t('倍率')} 1.0  (${t('原价')})\nvip ${t('用户')}  + standard ${t('令牌')} → ${t('倍率')} 1.0  (${t('原价，和普通用户一样')})`}
                </CodeBlock>
                <p className='mb-2 mt-2 text-xs leading-7'>
                  <strong>{t('配置特殊倍率后：')}</strong>
                </p>
                <CodeBlock>
                  {`${t('用户分组')}    ${t('使用分组')}    ${t('倍率')}\n────────────────────────────\nvip       standard   0.8\nvip       premium    0.3`}
                </CodeBlock>
                <p className='mt-2 text-xs leading-7'>
                  {t('配置后的效果：')}
                </p>
                <CodeBlock>
                  {`${t('普通用户')} + standard ${t('令牌')} → ${t('倍率')} 1.0  (${t('不变')})\nvip ${t('用户')}  + standard ${t('令牌')} → ${t('倍率')} 0.8  (${t('享受 8 折')})\nvip ${t('用户')}  + premium  ${t('令牌')} → ${t('倍率')} 0.3  (${t('从 0.5 降到 0.3')})`}
                </CodeBlock>
                <p className='mt-2 text-xs leading-7 text-muted'>
                  {t('只有配置了规则的组合才会覆盖，未配置的组合仍使用令牌分组的基础倍率。')}
                </p>
              </GuideSection>

              <GuideSection title={t('JSON 格式参考')}>
                <p className='mb-1 text-xs'>
                  <strong>
                    <code className='font-mono'>GroupGroupRatio</code>
                  </strong>
                  {' — '}
                  {t('嵌套映射：用户分组 → 使用分组 → 倍率')}
                </p>
                <CodeBlock>{`{\n  "vip": {\n    "standard": 0.8,\n    "premium": 0.3\n  }\n}`}</CodeBlock>
              </GuideSection>
            </div>
          )}

          {guideTab === 'usable' && (
            <div className='pt-5'>
              <h5 className='m-0 mb-3 text-base font-semibold text-foreground'>
                {t('特殊可用分组规则')}
              </h5>
              <p className='mb-2 text-sm leading-7 text-foreground'>
                {t(
                  '默认情况下，所有用户创建令牌时看到的可选分组列表是一样的（即「用户可选」列勾选的分组）。',
                )}
              </p>
              <p className='text-sm leading-7 text-foreground'>
                {t('通过此功能，可以根据用户所在分组，为不同等级的用户展示不同的可选列表。')}
              </p>

              <GuideSection title={t('查看示例')}>
                <p className='mb-2 text-xs text-muted'>
                  {t(
                    '场景：站点有 standard 和 premium 两个用户可选分组。希望 vip 用户额外看到 exclusive 分组，同时不再看到 standard 分组',
                  )}
                </p>
                <p className='mb-2 text-xs leading-7'>
                  <strong>{t('不配置规则时，所有用户看到的下拉框一样：')}</strong>
                </p>
                <CodeBlock>
                  {`${t('所有用户')} → ${t('创建令牌可选')}:\n  ├─ standard\n  └─ premium`}
                </CodeBlock>
                <p className='mb-2 mt-2 text-xs leading-7'>
                  <strong>{t('为 vip 用户配置规则：')}</strong>
                </p>
                <CodeBlock>
                  {`${t('用户分组')}    ${t('操作')}        ${t('目标分组')}    ${t('描述')}\n──────────────────────────────────────────\nvip       ${t('添加')} (+:)   exclusive   ${t('专属分组')}\nvip       ${t('移除')} (-:)   standard    -`}
                </CodeBlock>
                <p className='mt-2 text-xs leading-7'>
                  {t('配置后的效果：')}
                </p>
                <CodeBlock>
                  {`${t('普通用户')} → ${t('创建令牌可选')}:\n  ├─ standard\n  └─ premium\n\nvip ${t('用户')} → ${t('创建令牌可选')}:\n  ├─ premium     (${t('保留')})\n  └─ exclusive   (${t('新增')})\n\n  ${t('standard 已被移除，vip 用户看不到')}`}
                </CodeBlock>

                <p className='mt-3 text-xs leading-7'>
                  <strong>{t('三种操作的区别：')}</strong>
                </p>
                <CodeBlock>
                  {`${t('添加')} (+:)  → ${t('在默认列表基础上新增一个分组')}\n${t('移除')} (-:)  → ${t('从默认列表中去掉一个分组')}\n${t('追加')}       → ${t('直接追加（和添加类似，但无前缀）')}`}
                </CodeBlock>
              </GuideSection>

              <GuideSection title={t('JSON 格式参考')}>
                <p className='mb-1 text-xs'>
                  <strong>
                    <code className='font-mono'>group_special_usable_group</code>
                  </strong>
                </p>
                <CodeBlock>{`{\n  "vip": {\n    "+:exclusive": "${t('专属分组')}",\n    "-:standard": "remove"\n  }\n}`}</CodeBlock>
                <p className='mt-1.5 text-xs leading-6 text-muted'>
                  {t('键的前缀 +: 表示添加，-: 表示移除，无前缀表示追加。值为分组描述（移除时填 "remove"）。')}
                </p>
              </GuideSection>
            </div>
          )}
        </div>
      </aside>
    </>
  );

  return (
    <div className='relative space-y-4'>
      {loading && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]'>
          <Spinner color='primary' />
        </div>
      )}

      <div className='flex items-center gap-3'>
        <div className='inline-flex overflow-hidden rounded-xl border border-border'>
          {[
            { value: 'visual', label: t('可视化编辑') },
            { value: 'manual', label: t('手动编辑') },
          ].map((mode) => {
            const active = mode.value === editMode;
            return (
              <button
                key={mode.value}
                type='button'
                onClick={() => setEditMode(mode.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'bg-background text-muted hover:bg-surface-secondary'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
        <Button
          variant='light'
          size='sm'
          startContent={<HelpCircle size={14} />}
          onPress={() => setShowGuide(true)}
        >
          {t('使用说明')}
        </Button>
      </div>

      {editMode === 'visual' ? renderVisualMode() : renderManualMode()}

      <div>
        <Button color='primary' onPress={onSubmit}>
          {t('保存分组相关设置')}
        </Button>
      </div>

      {renderGuide()}
    </div>
  );
}
