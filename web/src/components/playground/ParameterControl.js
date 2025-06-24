import React from 'react';
import {
  Input,
  Slider,
  Typography,
  Button,
  Tag,
} from '@douyinfe/semi-ui';
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
  return (
    <>
      {/* Temperature */}
      <div className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.temperature || disabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Thermometer size={16} className="text-gray-500" />
            <Typography.Text strong className="text-sm">
              Temperature
            </Typography.Text>
            <Tag size="small" className="!rounded-full">
              {inputs.temperature}
            </Tag>
          </div>
          <Button
            theme={parameterEnabled.temperature ? 'solid' : 'borderless'}
            type={parameterEnabled.temperature ? 'primary' : 'tertiary'}
            size="small"
            icon={parameterEnabled.temperature ? <Check size={10} /> : <X size={10} />}
            onClick={() => onParameterToggle('temperature')}
            className="!rounded-full !w-4 !h-4 !p-0 !min-w-0"
            disabled={disabled}
          />
        </div>
        <Typography.Text className="text-xs text-gray-500 mb-2">
          控制输出的随机性和创造性
        </Typography.Text>
        <Slider
          step={0.1}
          min={0.1}
          max={1}
          value={inputs.temperature}
          onChange={(value) => onInputChange('temperature', value)}
          className="mt-2"
          disabled={!parameterEnabled.temperature || disabled}
        />
      </div>

      {/* Top P */}
      <div className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.top_p || disabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-gray-500" />
            <Typography.Text strong className="text-sm">
              Top P
            </Typography.Text>
            <Tag size="small" className="!rounded-full">
              {inputs.top_p}
            </Tag>
          </div>
          <Button
            theme={parameterEnabled.top_p ? 'solid' : 'borderless'}
            type={parameterEnabled.top_p ? 'primary' : 'tertiary'}
            size="small"
            icon={parameterEnabled.top_p ? <Check size={10} /> : <X size={10} />}
            onClick={() => onParameterToggle('top_p')}
            className="!rounded-full !w-4 !h-4 !p-0 !min-w-0"
            disabled={disabled}
          />
        </div>
        <Typography.Text className="text-xs text-gray-500 mb-2">
          核采样，控制词汇选择的多样性
        </Typography.Text>
        <Slider
          step={0.1}
          min={0.1}
          max={1}
          value={inputs.top_p}
          onChange={(value) => onInputChange('top_p', value)}
          className="mt-2"
          disabled={!parameterEnabled.top_p || disabled}
        />
      </div>

      {/* Frequency Penalty */}
      <div className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.frequency_penalty || disabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Repeat size={16} className="text-gray-500" />
            <Typography.Text strong className="text-sm">
              Frequency Penalty
            </Typography.Text>
            <Tag size="small" className="!rounded-full">
              {inputs.frequency_penalty}
            </Tag>
          </div>
          <Button
            theme={parameterEnabled.frequency_penalty ? 'solid' : 'borderless'}
            type={parameterEnabled.frequency_penalty ? 'primary' : 'tertiary'}
            size="small"
            icon={parameterEnabled.frequency_penalty ? <Check size={10} /> : <X size={10} />}
            onClick={() => onParameterToggle('frequency_penalty')}
            className="!rounded-full !w-4 !h-4 !p-0 !min-w-0"
            disabled={disabled}
          />
        </div>
        <Typography.Text className="text-xs text-gray-500 mb-2">
          频率惩罚，减少重复词汇的出现
        </Typography.Text>
        <Slider
          step={0.1}
          min={-2}
          max={2}
          value={inputs.frequency_penalty}
          onChange={(value) => onInputChange('frequency_penalty', value)}
          className="mt-2"
          disabled={!parameterEnabled.frequency_penalty || disabled}
        />
      </div>

      {/* Presence Penalty */}
      <div className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.presence_penalty || disabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Ban size={16} className="text-gray-500" />
            <Typography.Text strong className="text-sm">
              Presence Penalty
            </Typography.Text>
            <Tag size="small" className="!rounded-full">
              {inputs.presence_penalty}
            </Tag>
          </div>
          <Button
            theme={parameterEnabled.presence_penalty ? 'solid' : 'borderless'}
            type={parameterEnabled.presence_penalty ? 'primary' : 'tertiary'}
            size="small"
            icon={parameterEnabled.presence_penalty ? <Check size={10} /> : <X size={10} />}
            onClick={() => onParameterToggle('presence_penalty')}
            className="!rounded-full !w-4 !h-4 !p-0 !min-w-0"
            disabled={disabled}
          />
        </div>
        <Typography.Text className="text-xs text-gray-500 mb-2">
          存在惩罚，鼓励讨论新话题
        </Typography.Text>
        <Slider
          step={0.1}
          min={-2}
          max={2}
          value={inputs.presence_penalty}
          onChange={(value) => onInputChange('presence_penalty', value)}
          className="mt-2"
          disabled={!parameterEnabled.presence_penalty || disabled}
        />
      </div>

      {/* MaxTokens */}
      <div className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.max_tokens || disabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Hash size={16} className="text-gray-500" />
            <Typography.Text strong className="text-sm">
              Max Tokens
            </Typography.Text>
          </div>
          <Button
            theme={parameterEnabled.max_tokens ? 'solid' : 'borderless'}
            type={parameterEnabled.max_tokens ? 'primary' : 'tertiary'}
            size="small"
            icon={parameterEnabled.max_tokens ? <Check size={10} /> : <X size={10} />}
            onClick={() => onParameterToggle('max_tokens')}
            className="!rounded-full !w-4 !h-4 !p-0 !min-w-0"
            disabled={disabled}
          />
        </div>
        <Input
          placeholder='MaxTokens'
          name='max_tokens'
          required
          autoComplete='new-password'
          defaultValue={0}
          value={inputs.max_tokens}
          onChange={(value) => onInputChange('max_tokens', value)}
          className="!rounded-lg"
          disabled={!parameterEnabled.max_tokens || disabled}
        />
      </div>

      {/* Seed */}
      <div className={`transition-opacity duration-200 mb-4 ${!parameterEnabled.seed || disabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shuffle size={16} className="text-gray-500" />
            <Typography.Text strong className="text-sm">
              Seed
            </Typography.Text>
            <Typography.Text className="text-xs text-gray-400">
              (可选，用于复现结果)
            </Typography.Text>
          </div>
          <Button
            theme={parameterEnabled.seed ? 'solid' : 'borderless'}
            type={parameterEnabled.seed ? 'primary' : 'tertiary'}
            size="small"
            icon={parameterEnabled.seed ? <Check size={10} /> : <X size={10} />}
            onClick={() => onParameterToggle('seed')}
            className="!rounded-full !w-4 !h-4 !p-0 !min-w-0"
            disabled={disabled}
          />
        </div>
        <Input
          placeholder='随机种子 (留空为随机)'
          name='seed'
          autoComplete='new-password'
          value={inputs.seed || ''}
          onChange={(value) => onInputChange('seed', value === '' ? null : value)}
          className="!rounded-lg"
          disabled={!parameterEnabled.seed || disabled}
        />
      </div>
    </>
  );
};

export default ParameterControl; 