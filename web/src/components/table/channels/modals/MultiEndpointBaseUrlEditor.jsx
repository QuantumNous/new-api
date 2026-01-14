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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  Card,
  Divider,
  Input,
  Nav,
  Space,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconCopy,
  IconRefresh,
} from '@douyinfe/semi-icons';
import { copy, verifyJSON } from '../../../../helpers';

const { Text } = Typography;

const ENDPOINTS = [
  {
    key: 'default',
    titleKey: 'default',
    descriptionKey: '当未配置某个端点时的兜底 URL',
    pathKey: '',
    navLabel: 'default',
    fillable: false,
  },
  {
    key: 'openai',
    titleKey: '/v1/chat/completions',
    descriptionKey: '对应 /v1/chat/completions',
    pathKey: '/v1/chat/completions',
    navLabel: '/v1/chat/completions',
    fillable: true,
  },
  {
    key: 'claude',
    titleKey: '/v1/messages',
    descriptionKey: '对应 /v1/messages',
    pathKey: '/v1/messages',
    navLabel: '/v1/messages',
    fillable: false,
  },
  {
    key: 'gemini',
    titleKey: '/v1beta/models/*',
    descriptionKey: '对应 /v1beta/models/*',
    pathKey: '/v1beta/models',
    navLabel: '/v1beta/models/*',
    fillable: true,
  },
  {
    key: 'openai_responses',
    titleKey: '/v1/responses',
    descriptionKey: '对应 /v1/responses',
    pathKey: '/v1/responses',
    navLabel: '/v1/responses',
    fillable: true,
  },
  {
    key: 'embedding',
    titleKey: '/v1/embeddings',
    descriptionKey: '对应 /v1/embeddings',
    pathKey: '/v1/embeddings',
    navLabel: '/v1/embeddings',
    fillable: true,
  },
  {
    key: 'openai_image',
    titleKey: '/v1/images/*',
    descriptionKey: '对应 /v1/images/generations、/v1/images/edits、/v1/edits',
    pathKey: '',
    navLabel: '/v1/images/*',
    fillable: true,
  },
  {
    key: 'openai_audio',
    titleKey: '/v1/audio/*',
    descriptionKey:
      '对应 /v1/audio/transcriptions、/v1/audio/translations、/v1/audio/speech',
    pathKey: '',
    navLabel: '/v1/audio/*',
    fillable: true,
  },
  {
    key: 'openai_realtime',
    titleKey: '/v1/realtime',
    descriptionKey: '对应 /v1/realtime（WebSocket）',
    pathKey: '/v1/realtime',
    navLabel: '/v1/realtime',
    fillable: true,
  },
  {
    key: 'rerank',
    titleKey: '/v1/rerank',
    descriptionKey: '对应 /v1/rerank',
    pathKey: '/v1/rerank',
    navLabel: '/v1/rerank',
    fillable: true,
  },
];

const KEY_ORDER = ENDPOINTS.map((e) => e.key);

function canonicalKey(key) {
  const raw = String(key || '')
    .trim()
    .toLowerCase()
    .replaceAll('-', '_')
    .replaceAll(' ', '');

  switch (raw) {
    case 'default':
      return 'default';
    case 'openai':
      return 'openai';
    case 'openai_response':
    case 'openai_responses':
    case 'openairesponses':
    case 'openairesponse':
      return 'openai_responses';
    case 'embedding':
    case 'embeddings':
      return 'embedding';
    case 'claude':
    case 'anthropic':
      return 'claude';
    case 'gemini':
      return 'gemini';
    case 'openai_image':
    case 'openai_image_generation':
    case 'openai_image_edit':
    case 'image':
    case 'images':
    case 'image_generation':
    case 'imagegeneration':
    case 'image_generations':
    case 'imagegenerations':
      return 'openai_image';
    case 'openai_audio':
    case 'audio':
      return 'openai_audio';
    case 'openai_realtime':
    case 'realtime':
      return 'openai_realtime';
    case 'rerank':
      return 'rerank';
    default:
      return '';
  }
}

function normalizeUrl(value) {
  const v = String(value || '').trim();
  return v;
}

function parseConfig(value) {
  const raw = String(value || '').trim();
  if (!raw) return { mapping: {}, error: '' };

  if (!raw.startsWith('{')) {
    return { mapping: { openai: normalizeUrl(raw) }, error: '' };
  }

  if (!verifyJSON(raw)) return { mapping: {}, error: 'Invalid JSON' };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { mapping: {}, error: 'JSON must be an object' };
    }
    const out = {};
    Object.entries(parsed).forEach(([k, v]) => {
      const ck = canonicalKey(k);
      if (!ck) return;
      if (typeof v !== 'string') return;
      const url = normalizeUrl(v);
      if (!url) return;
      out[ck] = url;
    });
    return { mapping: out, error: '' };
  } catch (error) {
    return { mapping: {}, error: error?.message || 'Invalid JSON' };
  }
}

function stableStringify(mapping) {
  const ordered = {};
  KEY_ORDER.forEach((k) => {
    if (mapping[k]) ordered[k] = mapping[k];
  });
  const keys = Object.keys(ordered);
  if (keys.length === 0) return '';
  if (keys.length === 1 && keys[0] === 'openai') return ordered.openai;
  return JSON.stringify(ordered, null, 2);
}

function applyModelTemplate(value, model) {
  if (!value) return '';
  if (!model) return value;
  return String(value).replaceAll('{model}', model);
}

function previewRealtimeScheme(value) {
  if (value.startsWith('https://'))
    return `wss://${value.slice('https://'.length)}`;
  if (value.startsWith('http://'))
    return `ws://${value.slice('http://'.length)}`;
  return value;
}

const MultiEndpointBaseUrlEditor = ({ value, onChange, disabled = false }) => {
  const { t } = useTranslation();

  const parsed = useMemo(() => parseConfig(value), [value]);
  const [local, setLocal] = useState(parsed.mapping);
  const [parseError, setParseError] = useState(parsed.error);
  const [selectedKey, setSelectedKey] = useState('openai');
  const [mode, setMode] = useState('visual');
  const [rawText, setRawText] = useState(() => (typeof value === 'string' ? value : ''));
  const [sampleModel, setSampleModel] = useState('gpt-4o-mini');
  const [quickBase, setQuickBase] = useState('');

  useEffect(() => {
    setLocal(parsed.mapping);
    setParseError(parsed.error);
    setRawText(typeof value === 'string' ? value : '');
  }, [parsed.mapping, parsed.error]);

  const emit = useCallback(
    (next) => {
      setLocal(next);
      const json = stableStringify(next);
      onChange?.(json);
    },
    [onChange],
  );

  const emitRaw = useCallback(
    (nextRaw) => {
      setRawText(nextRaw);
      if (!nextRaw.trim()) {
        setParseError('');
        emit({});
        return;
      }
      const parsedNext = parseConfig(nextRaw);
      setParseError(parsedNext.error);
      if (!parsedNext.error) {
        emit(parsedNext.mapping);
      }
    },
    [emit],
  );

  const updateKey = useCallback(
    (key, nextValue) => {
      const next = { ...local };
      const cleaned = normalizeUrl(nextValue);
      if (!cleaned) delete next[key];
      else next[key] = cleaned;
      emit(next);
    },
    [local, emit],
  );

  const requiredSatisfied = useMemo(() => {
    return Boolean(local.openai || local.default);
  }, [local.openai, local.default]);

  const fillTemplate = useCallback(() => {
    const template = {
      openai: 'https://api.openai.com/v1/chat/completions',
      openai_responses: 'https://api.openai.com/v1/responses',
    };
    emit(template);
  }, [emit]);

  const fillMissingWithBase = useCallback(() => {
    const base = String(quickBase || '').trim().replace(/\/+$/g, '');
    if (!base) return;
    const next = { ...local };
    ENDPOINTS.forEach((e) => {
      if (e.key === 'default') return;
      if (e.fillable === false) return;
      if (next[e.key]) return;
      if (!e.pathKey) {
        next[e.key] = base;
      } else {
        next[e.key] = `${base}${e.pathKey}`;
      }
    });
    if (!next.openai && base) {
      next.openai = `${base}/v1/chat/completions`;
    }
    emit(next);
  }, [quickBase, local, emit]);

  const copyTemplate = useCallback(() => {
    const template = stableStringify({
      openai: 'https://api.openai.com/v1/chat/completions',
      openai_responses: 'https://api.openai.com/v1/responses',
    });
    copy(template);
  }, []);

  const copyCurrent = useCallback(() => {
    copy(stableStringify(local));
  }, [local]);

  const selected = useMemo(() => {
    return ENDPOINTS.find((e) => e.key === selectedKey) || ENDPOINTS[0];
  }, [selectedKey]);

  const selectedValue = local[selected.key] || '';
  const selectedPreview = useMemo(() => {
    const v = applyModelTemplate(selectedValue, sampleModel);
    if (!v) return '';
    if (selected.key === 'openai_realtime') return previewRealtimeScheme(v);
    return v;
  }, [selected.key, selectedValue, sampleModel]);

  const selectedStatus = useMemo(() => {
    if (selectedValue) return { ok: true, text: t('已配置') };
    if (selected.key === 'openai' || selected.key === 'default') {
      return { ok: false, text: t('必填') };
    }
    return { ok: false, text: t('未配置') };
  }, [selected.key, selectedValue, t]);

  return (
    <div>
      <Space vertical align='start' style={{ width: '100%' }}>
        <Banner
          type='info'
          description={t('base_url 里填写“最终请求地址”，支持 JSON 按端点拆分；支持变量 {model}。')}
          className='!rounded-lg'
        />

        {!requiredSatisfied && (
          <Banner
            type='warning'
            description={t('至少需要填写 default 或 openai 其中一个。')}
            className='!rounded-lg'
          />
        )}

        {parseError && (
          <Banner
            type='danger'
            description={`${t('base_url 解析失败')}: ${parseError}`}
            className='!rounded-lg'
          />
        )}

        <Card className='!rounded-2xl shadow-sm border-0 w-full'>
          <div className='w-full flex items-center justify-between'>
            <Text strong>{t('端点配置')}</Text>
            <Space>
              <Button
                size='small'
                icon={<IconRefresh />}
                onClick={fillTemplate}
                disabled={disabled}
              >
                {t('填入模板')}
              </Button>
              <Button size='small' icon={<IconCopy />} onClick={copyTemplate}>
                {t('复制模板')}
              </Button>
              <Button size='small' icon={<IconCopy />} onClick={copyCurrent}>
                {t('复制当前配置')}
              </Button>
            </Space>
          </div>

          <Divider margin='12px' />

          <div className='w-full flex items-center justify-between'>
            <Space>
              <Button
                size='small'
                type={mode === 'visual' ? 'primary' : 'tertiary'}
                onClick={() => setMode('visual')}
              >
                {t('可视化')}
              </Button>
              <Button
                size='small'
                type={mode === 'raw' ? 'primary' : 'tertiary'}
                onClick={() => setMode('raw')}
              >
                {t('手动编辑')}
              </Button>
            </Space>
          </div>

          {mode === 'raw' && (
            <div className='mt-3'>
              <TextArea
                value={rawText}
                disabled={disabled}
                placeholder='https://api.openai.com/v1/chat/completions\n\n{\n  "openai": "https://api.openai.com/v1/chat/completions"\n}'
                autosize={{ minRows: 6, maxRows: 16 }}
                onChange={(v) => emitRaw(v)}
              />
            </div>
          )}

          {mode === 'visual' && (
            <div className='mt-3 flex gap-3'>
              <div className='min-w-[240px]'>
                <Nav
                  style={{ width: 240 }}
                  selectedKeys={[selectedKey]}
                  onSelect={(data) => setSelectedKey(data.itemKey)}
                >
                  {ENDPOINTS.map((e) => {
                    const configured = Boolean(local[e.key]);
                    const isRequired = e.key === 'openai' || e.key === 'default';
                    const tagColor = configured ? 'green' : isRequired ? 'red' : 'grey';
                    const tagText = configured ? t('已配置') : isRequired ? t('必填') : t('未配置');
                    return (
                      <Nav.Item itemKey={e.key} key={e.key}>
                        <div className='flex items-center justify-between w-full'>
                          <span className='font-mono text-xs'>{e.navLabel || e.titleKey}</span>
                          <Tag color={tagColor} size='small'>
                            {tagText}
                          </Tag>
                        </div>
                      </Nav.Item>
                    );
                  })}
                </Nav>
              </div>

              <div className='flex-1'>
                <div className='flex items-center justify-between'>
                  <Space>
                    <Text strong className='font-mono'>
                      {selected.titleKey}
                    </Text>
                    <Tag color={selectedStatus.ok ? 'green' : 'red'} size='small'>
                      {selectedStatus.ok ? (
                        <span className='inline-flex items-center gap-1'>
                          <IconCheckCircle size={12} />
                          {selectedStatus.text}
                        </span>
                      ) : (
                        <span className='inline-flex items-center gap-1'>
                          <IconAlertTriangle size={12} />
                          {selectedStatus.text}
                        </span>
                      )}
                    </Tag>
                  </Space>
                  <Button
                    size='small'
                    type='tertiary'
                    onClick={() => updateKey(selected.key, '')}
                    disabled={disabled}
                  >
                    {t('清空')}
                  </Button>
                </div>
                <div className='text-xs text-gray-500 mt-1'>{t(selected.descriptionKey)}</div>

                <div className='mt-3'>
                  <Input
                    disabled={disabled}
                    value={selectedValue}
                    placeholder='https://api.example.com/v1/chat/completions'
                    showClear
                    onChange={(v) => updateKey(selected.key, v)}
                  />
                  <div className='text-xs text-gray-500 mt-1'>
                    {t('提示：这里填写最终请求地址，不是 Base URL；如需按模型拆分可使用 {model}。')}
                  </div>
                </div>

                <Divider margin='12px' />

                <div className='flex items-center justify-between'>
                  <Text strong>{t('预览')}</Text>
                </div>

                <div className='mt-2 grid grid-cols-1 gap-3'>
                  <div>
                    <div className='text-xs text-gray-500'>{t('示例模型')}</div>
                    <Input
                      disabled={disabled}
                      value={sampleModel}
                      onChange={(v) => setSampleModel(v)}
                      showClear
                    />
                  </div>

                  <div className='rounded-xl border border-gray-200 p-3'>
                    <div className='text-xs text-gray-500'>{t('最终请求地址（渲染 {model} 后）')}</div>
                    <div className='mt-1 break-all font-mono text-xs'>
                      {selectedPreview || '-'}
                    </div>
                    {selected.key === 'openai_realtime' && selectedPreview && (
                      <div className='text-xs text-gray-500 mt-2'>
                        {t('Realtime 端点会自动使用 ws/wss 协议；如果你填的是 http/https，这里会自动转换。')}
                      </div>
                    )}
                  </div>

                  <div className='rounded-xl border border-gray-200 p-3'>
                    <div className='text-xs text-gray-500'>{t('当前配置（实际存储）')}</div>
                    <div className='mt-1 break-all font-mono text-xs'>
                      {stableStringify(local) || '-'}
                    </div>
                  </div>
                </div>

                <Divider margin='12px' />

                <div className='rounded-xl border border-gray-200 p-3'>
                  <Text strong>{t('快速填充')}</Text>
                  <div className='text-xs text-gray-500 mt-1'>
                    {t('填一个通用 base（例如 https://api.openai.com），自动补齐缺失端点的标准路径。')}
                  </div>
                  <div className='mt-2 flex items-center gap-2'>
                    <Input
                      disabled={disabled}
                      value={quickBase}
                      placeholder='https://api.openai.com'
                      showClear
                      onChange={(v) => setQuickBase(v)}
                    />
                    <Button disabled={disabled || !quickBase.trim()} onClick={fillMissingWithBase}>
                      {t('补齐缺失')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </Space>
    </div>
  );
};

export default MultiEndpointBaseUrlEditor;
