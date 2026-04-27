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

import React, { useEffect, useState, useMemo } from 'react';
import { Button, Input, ListBox, Switch } from '@heroui/react';
import { CellSelect } from '@heroui-pro/react';
import { ChevronsUpDown } from 'lucide-react';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const DEFAULT_INPUTS = {
  TopUpLink: '',
  'general_setting.docs_link': '',
  'general_setting.quota_display_type': 'USD',
  'general_setting.custom_currency_symbol': '¤',
  'general_setting.custom_currency_exchange_rate': '',
  QuotaPerUnit: '',
  RetryTimes: '',
  USDExchangeRate: '',
  DisplayTokenStatEnabled: false,
  DefaultCollapseSidebar: false,
  DemoSiteEnabled: false,
  SelfUseModeEnabled: false,
  'token_setting.max_user_tokens': 1000,
};

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

const selectClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

function TextField({ label, value, onChange, placeholder, helper }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <Input
        type='text'
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={inputClass}
      />
      {helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

function NumberField({ label, value, onChange, placeholder, helper, min, step }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <Input
        type='number'
        value={value === '' || value == null ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? '' : Number(v));
        }}
        placeholder={placeholder}
        min={min}
        step={step}
        aria-label={label}
        className={inputClass}
      />
      {helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

function ToggleRow({ label, helper, value, onChange }) {
  return (
    <div className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-medium text-foreground'>{label}</div>
        {helper ? (
          <div className='mt-1 text-xs leading-snug text-muted'>{helper}</div>
        ) : null}
      </div>
      <Switch
        isSelected={!!value}
        onChange={onChange}
        aria-label={label}
        size='sm'
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </div>
  );
}

export default function GeneralSettings(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_INPUTS);

  const setField = (field) => (value) =>
    setInputs((prev) => ({ ...prev, [field]: value }));

  const onSubmit = () => {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = inputs[item.key];
      }
      return API.put('/api/option/', { key: item.key, value });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (res.includes(undefined)) {
          if (requestQueue.length > 1) {
            return showError(t('部分保存失败，请重试'));
          }
          return;
        }
        showSuccess(t('保存成功'));
        props.refresh?.();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  };

  const combinedRate = useMemo(() => {
    const type = inputs['general_setting.quota_display_type'];
    if (type === 'USD') return '1';
    if (type === 'CNY') return String(inputs['USDExchangeRate'] || '');
    if (type === 'TOKENS') return String(inputs['QuotaPerUnit'] || '');
    if (type === 'CUSTOM')
      return String(
        inputs['general_setting.custom_currency_exchange_rate'] || '',
      );
    return '';
  }, [inputs]);

  const onCombinedRateChange = (val) => {
    const type = inputs['general_setting.quota_display_type'];
    if (type === 'CNY') {
      setField('USDExchangeRate')(val);
    } else if (type === 'TOKENS') {
      setField('QuotaPerUnit')(val);
    } else if (type === 'CUSTOM') {
      setField('general_setting.custom_currency_exchange_rate')(val);
    }
  };

  const showTokensOption = useMemo(() => {
    const initialType = props.options?.['general_setting.quota_display_type'];
    const initialQuotaPerUnit = parseFloat(props.options?.QuotaPerUnit);
    const legacyTokensMode =
      initialType === undefined &&
      props.options?.DisplayInCurrencyEnabled !== undefined &&
      !props.options.DisplayInCurrencyEnabled;
    return (
      initialType === 'TOKENS' ||
      legacyTokensMode ||
      (!isNaN(initialQuotaPerUnit) && initialQuotaPerUnit !== 500000)
    );
  }, [props.options]);

  const quotaDisplayType = inputs['general_setting.quota_display_type'];

  const quotaDisplayTypeDesc = useMemo(() => {
    const descMap = {
      USD: t('站点所有额度将以美元 ($) 显示'),
      CNY: t('站点所有额度将按汇率换算为人民币 (¥) 显示'),
      TOKENS: t('站点所有额度将以原始 Token 数显示，不做货币换算'),
      CUSTOM: t('站点所有额度将按汇率换算为自定义货币显示'),
    };
    return descMap[quotaDisplayType] || '';
  }, [quotaDisplayType, t]);

  const rateLabel = useMemo(() => {
    if (quotaDisplayType === 'CNY') return t('汇率');
    if (quotaDisplayType === 'TOKENS') return t('每美元对应 Token 数');
    if (quotaDisplayType === 'CUSTOM') return t('汇率');
    return '';
  }, [quotaDisplayType, t]);

  const rateSuffix = useMemo(() => {
    if (quotaDisplayType === 'CNY') return 'CNY (¥)';
    if (quotaDisplayType === 'TOKENS') return 'Tokens';
    if (quotaDisplayType === 'CUSTOM')
      return inputs['general_setting.custom_currency_symbol'] || '¤';
    return '';
  }, [quotaDisplayType, inputs]);

  const rateExtraText = useMemo(() => {
    if (quotaDisplayType === 'CNY')
      return t(
        '系统内部以美元 (USD) 为基准计价。用户余额、充值金额、模型定价、用量日志等所有金额显示均按此汇率换算为人民币，不影响内部计费',
      );
    if (quotaDisplayType === 'TOKENS')
      return t(
        '系统内部计费精度，默认 500000，修改可能导致计费异常，请谨慎操作',
      );
    if (quotaDisplayType === 'CUSTOM')
      return t(
        '系统内部以美元 (USD) 为基准计价。用户余额、充值金额、模型定价、用量日志等所有金额显示均按此汇率换算为自定义货币，不影响内部计费',
      );
    return '';
  }, [quotaDisplayType, t]);

  const previewText = useMemo(() => {
    if (quotaDisplayType === 'USD') return '$1.00';
    const rate = parseFloat(combinedRate);
    if (!rate || isNaN(rate)) return t('请输入汇率');
    if (quotaDisplayType === 'CNY') return `$1.00 → ¥${rate.toFixed(2)}`;
    if (quotaDisplayType === 'TOKENS')
      return `$1.00 → ${Number(rate).toLocaleString()} Tokens`;
    if (quotaDisplayType === 'CUSTOM') {
      const symbol = inputs['general_setting.custom_currency_symbol'] || '¤';
      return `$1.00 → ${symbol}${rate.toFixed(2)}`;
    }
    return '';
  }, [quotaDisplayType, combinedRate, inputs, t]);

  useEffect(() => {
    const currentInputs = { ...DEFAULT_INPUTS };
    for (const key in props.options) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_INPUTS, key)) {
        currentInputs[key] = props.options[key];
      }
    }
    if (
      currentInputs['general_setting.quota_display_type'] === undefined &&
      props.options?.DisplayInCurrencyEnabled !== undefined
    ) {
      currentInputs['general_setting.quota_display_type'] = props.options
        .DisplayInCurrencyEnabled
        ? 'USD'
        : 'TOKENS';
    }
    if (props.options?.['general_setting.custom_currency_symbol'] !== undefined) {
      currentInputs['general_setting.custom_currency_symbol'] =
        props.options['general_setting.custom_currency_symbol'];
    }
    if (
      props.options?.['general_setting.custom_currency_exchange_rate'] !==
      undefined
    ) {
      currentInputs['general_setting.custom_currency_exchange_rate'] =
        props.options['general_setting.custom_currency_exchange_rate'];
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
  }, [props.options]);

  return (
    <div className='p-6 space-y-6'>
      <div className='text-base font-semibold text-foreground'>
        {t('通用设置')}
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <TextField
          label={t('充值链接')}
          value={inputs.TopUpLink}
          onChange={setField('TopUpLink')}
          placeholder={t('例如发卡网站的购买链接')}
        />
        <TextField
          label={t('文档地址')}
          value={inputs['general_setting.docs_link']}
          onChange={setField('general_setting.docs_link')}
          placeholder={t('例如 https://docs.newapi.pro')}
        />
        <TextField
          label={t('失败重试次数')}
          value={inputs.RetryTimes}
          onChange={setField('RetryTimes')}
          placeholder={t('失败重试次数')}
        />

        <div className='space-y-2'>
          {/* heroui-pro CellSelect — settings-cell styled dropdown matching
              the rest of the design system (see also PreferencesSettings's
              language picker which uses the same pattern). The label lives
              inside the trigger row, so the explicit `<div>` label above
              the native `<select>` is no longer needed. */}
          <CellSelect
            aria-label={t('额度展示类型')}
            selectedKey={quotaDisplayType}
            onSelectionChange={(key) => {
              if (key)
                setField('general_setting.quota_display_type')(String(key));
            }}
          >
            <CellSelect.Trigger>
              <CellSelect.Label>{t('额度展示类型')}</CellSelect.Label>
              <CellSelect.Value />
              <CellSelect.Indicator>
                <ChevronsUpDown size={14} />
              </CellSelect.Indicator>
            </CellSelect.Trigger>
            <CellSelect.Popover>
              <ListBox>
                <ListBox.Item id='USD' textValue='USD ($)'>
                  USD ($)
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id='CNY' textValue='CNY (¥)'>
                  CNY (¥)
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {showTokensOption ? (
                  <ListBox.Item id='TOKENS' textValue='Tokens'>
                    Tokens
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ) : null}
                <ListBox.Item id='CUSTOM' textValue={t('自定义货币')}>
                  {t('自定义货币')}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </CellSelect.Popover>
          </CellSelect>
          {quotaDisplayTypeDesc ? (
            <div className='text-xs leading-snug text-muted'>
              {quotaDisplayTypeDesc}
            </div>
          ) : null}
        </div>

        {quotaDisplayType !== 'USD' && (
          <div className='space-y-2'>
            <div className='text-sm font-medium text-foreground'>
              {rateLabel}
            </div>
            <div className='flex h-10 items-center overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-background text-sm transition focus-within:border-primary'>
              <span className='whitespace-nowrap pl-3 text-muted'>
                1 USD =
              </span>
              <input
                type='text'
                value={combinedRate}
                onChange={(e) => onCombinedRateChange(e.target.value)}
                aria-label={rateLabel}
                className='h-full flex-1 min-w-0 bg-transparent px-2 text-foreground outline-none'
              />
              <span className='whitespace-nowrap pr-3 text-muted'>
                {rateSuffix}
              </span>
            </div>
            {rateExtraText ? (
              <div className='text-xs leading-snug text-muted'>
                {rateExtraText}
              </div>
            ) : null}
          </div>
        )}

        {quotaDisplayType === 'CUSTOM' && (
          <TextField
            label={t('自定义货币符号')}
            value={inputs['general_setting.custom_currency_symbol']}
            onChange={setField('general_setting.custom_currency_symbol')}
            placeholder={t('例如 €, £, Rp, ₩, ₹...')}
            helper={t('自定义货币符号将显示在所有额度数值前，例如 €1.50')}
          />
        )}
      </div>

      <div className='text-xs text-muted'>
        {t('预览效果')}：{previewText}
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <ToggleRow
          label={t('额度查询接口返回令牌额度而非用户额度')}
          value={inputs.DisplayTokenStatEnabled}
          onChange={setField('DisplayTokenStatEnabled')}
        />
        <ToggleRow
          label={t('默认折叠侧边栏')}
          value={inputs.DefaultCollapseSidebar}
          onChange={setField('DefaultCollapseSidebar')}
        />
        <ToggleRow
          label={t('演示站点模式')}
          value={inputs.DemoSiteEnabled}
          onChange={setField('DemoSiteEnabled')}
        />
        <ToggleRow
          label={t('自用模式')}
          helper={t('开启后不限制：必须设置模型倍率')}
          value={inputs.SelfUseModeEnabled}
          onChange={setField('SelfUseModeEnabled')}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <NumberField
          label={t('用户最大令牌数量')}
          value={inputs['token_setting.max_user_tokens']}
          onChange={setField('token_setting.max_user_tokens')}
          placeholder='1000'
          min={1}
          step={1}
          helper={t(
            '每个用户最多可创建的令牌数量，默认 1000，设置过大可能会影响性能',
          )}
        />
      </div>

      <div className='border-t border-[color:var(--app-border)] pt-4'>
        <Button
          color='primary'
          size='md'
          onPress={onSubmit}
          isPending={loading}
          className='min-w-[120px]'
        >
          {t('保存通用设置')}
        </Button>
      </div>
    </div>
  );
}
