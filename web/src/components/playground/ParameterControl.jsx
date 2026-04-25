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

import React from 'react';
import { Input, Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import {
  Hash,
  Thermometer,
  Target,
  Repeat,
  Ban,
  Shuffle,
  Check,
  X,
} from 'lucide-react';

const ParameterControl = ({
  inputs,
  parameterEnabled,
  onInputChange,
  onParameterToggle,
  disabled = false,
}) => {
  const { t } = useTranslation();

  const ValuePill = ({ children }) => (
    <span className='rounded-full border border-border bg-surface-secondary px-2 py-0.5 text-xs font-medium text-muted'>
      {children}
    </span>
  );

  const ToggleButton = ({ enabled, onPress }) => (
    <Button
      isIconOnly
      variant={enabled ? 'primary' : 'ghost'}
      size='sm'
      onPress={onPress}
      className='h-5 min-w-5 rounded-full p-0'
      isDisabled={disabled}
      aria-label={enabled ? t('停用参数') : t('启用参数')}
    >
      {enabled ? <Check size={10} /> : <X size={10} />}
    </Button>
  );

  const ParameterLabel = ({ icon, title, value, hint }) => (
    <div className='flex items-center gap-2'>
      {icon}
      <span className='text-sm font-semibold text-foreground'>{title}</span>
      {value !== undefined ? <ValuePill>{value}</ValuePill> : null}
      {hint ? <span className='text-xs text-gray-400'>{hint}</span> : null}
    </div>
  );

  const RangeControl = ({ value, min, max, step, onChange, isDisabled }) => (
    <input
      type='range'
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      disabled={isDisabled}
      className='mt-2 w-full accent-blue-500 disabled:cursor-not-allowed'
    />
  );

  return (
    <>
      {/* Temperature */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.temperature || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <ParameterLabel
            icon={<Thermometer size={16} className='text-gray-500' />}
            title='Temperature'
            value={inputs.temperature}
          />
          <ToggleButton
            enabled={parameterEnabled.temperature}
            onPress={() => onParameterToggle('temperature')}
          />
        </div>
        <span className='mb-2 block text-xs text-gray-500'>
          {t('控制输出的随机性和创造性')}
        </span>
        <RangeControl
          step={0.1}
          min={0.1}
          max={1}
          value={inputs.temperature}
          onChange={(value) => onInputChange('temperature', value)}
          isDisabled={!parameterEnabled.temperature || disabled}
        />
      </div>

      {/* Top P */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.top_p || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <ParameterLabel
            icon={<Target size={16} className='text-gray-500' />}
            title='Top P'
            value={inputs.top_p}
          />
          <ToggleButton
            enabled={parameterEnabled.top_p}
            onPress={() => onParameterToggle('top_p')}
          />
        </div>
        <span className='mb-2 block text-xs text-gray-500'>
          {t('核采样，控制词汇选择的多样性')}
        </span>
        <RangeControl
          step={0.1}
          min={0.1}
          max={1}
          value={inputs.top_p}
          onChange={(value) => onInputChange('top_p', value)}
          isDisabled={!parameterEnabled.top_p || disabled}
        />
      </div>

      {/* Frequency Penalty */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.frequency_penalty || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <ParameterLabel
            icon={<Repeat size={16} className='text-gray-500' />}
            title='Frequency Penalty'
            value={inputs.frequency_penalty}
          />
          <ToggleButton
            enabled={parameterEnabled.frequency_penalty}
            onPress={() => onParameterToggle('frequency_penalty')}
          />
        </div>
        <span className='mb-2 block text-xs text-gray-500'>
          {t('频率惩罚，减少重复词汇的出现')}
        </span>
        <RangeControl
          step={0.1}
          min={-2}
          max={2}
          value={inputs.frequency_penalty}
          onChange={(value) => onInputChange('frequency_penalty', value)}
          isDisabled={!parameterEnabled.frequency_penalty || disabled}
        />
      </div>

      {/* Presence Penalty */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.presence_penalty || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <ParameterLabel
            icon={<Ban size={16} className='text-gray-500' />}
            title='Presence Penalty'
            value={inputs.presence_penalty}
          />
          <ToggleButton
            enabled={parameterEnabled.presence_penalty}
            onPress={() => onParameterToggle('presence_penalty')}
          />
        </div>
        <span className='mb-2 block text-xs text-gray-500'>
          {t('存在惩罚，鼓励讨论新话题')}
        </span>
        <RangeControl
          step={0.1}
          min={-2}
          max={2}
          value={inputs.presence_penalty}
          onChange={(value) => onInputChange('presence_penalty', value)}
          isDisabled={!parameterEnabled.presence_penalty || disabled}
        />
      </div>

      {/* MaxTokens */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.max_tokens || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <ParameterLabel
            icon={<Hash size={16} className='text-gray-500' />}
            title='Max Tokens'
          />
          <ToggleButton
            enabled={parameterEnabled.max_tokens}
            onPress={() => onParameterToggle('max_tokens')}
          />
        </div>
        <input
          type='number'
          placeholder='MaxTokens'
          name='max_tokens'
          value={inputs.max_tokens ?? ''}
          onChange={(event) =>
            onInputChange(
              'max_tokens',
              event.target.value === '' ? null : Number(event.target.value),
            )
          }
          min={0}
          step={1}
          className='h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60'
          disabled={!parameterEnabled.max_tokens || disabled}
        />
      </div>

      {/* Seed */}
      <div
        className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.seed || disabled ? 'opacity-50' : ''}`}
      >
        <div className='flex items-center justify-between mb-2'>
          <ParameterLabel
            icon={<Shuffle size={16} className='text-gray-500' />}
            title='Seed'
            hint={`(${t('可选，用于复现结果')})`}
          />
          <ToggleButton
            enabled={parameterEnabled.seed}
            onPress={() => onParameterToggle('seed')}
          />
        </div>
        <Input
          placeholder={t('随机种子 (留空为随机)')}
          name='seed'
          autoComplete='new-password'
          value={inputs.seed || ''}
          onChange={(event) =>
            onInputChange(
              'seed',
              event.target.value === '' ? null : event.target.value,
            )
          }
          className='rounded-lg'
          isDisabled={!parameterEnabled.seed || disabled}
        />
      </div>
    </>
  );
};

export default ParameterControl;
