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
  Button,
  Card,
  Select,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  Clapperboard,
  Eye,
  Image as ImageIcon,
  ImagePlus,
  LayoutPanelLeft,
  MessageSquareText,
  Plus,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { API } from '../../helpers';

const TEXT = {
  creationCenter: '\u521b\u4f5c\u4e2d\u5fc3',
  unifiedStudio: '\u7edf\u4e00\u521b\u4f5c\u5de5\u4f5c\u53f0',
  currentWorkspace: '\u5f53\u524d\u5de5\u4f5c\u533a',
  layoutHint:
    '\u53bb\u6389\u72ec\u7acb\u5927\u6a2a\u5e45\u540e\uff0c\u8ba9\u521b\u4f5c\u533a\u57df\u76f4\u63a5\u94fa\u5f00\u5728\u9875\u9762\u4e3b\u89c6\u533a\uff0c\u8d28\u611f\u66f4\u96c6\u4e2d\u3002',
  switchSection: '\u5207\u6362\u677f\u5757',
  switchHint:
    '\u53c2\u8003\u4e0d\u540c\u521b\u4f5c\u9875\u9762\u7684\u5e03\u5c40\u7279\u5f81\uff0c\u7edf\u4e00\u6210\u540c\u4e00\u5957\u521b\u4f5c\u4e2d\u5fc3\u98ce\u683c\u3002',
  chat: '\u667a\u80fd\u5bf9\u8bdd',
  image: '\u56fe\u7247\u521b\u4f5c',
  video: '\u89c6\u9891\u521b\u4f5c',
  chatSub:
    '\u50cf\u53c2\u8003\u56fe\u4e00\u90a3\u6837\u4fdd\u7559\u5927\u9762\u79ef\u4f1a\u8bdd\u7a7a\u95f4\uff0c\u4f46\u7edf\u4e00\u5230\u521b\u4f5c\u4e2d\u5fc3\u7684\u5de5\u4f5c\u53f0\u8bed\u8a00\u91cc\u3002',
  imageSub:
    '\u53c2\u8003\u56fe\u4e8c\u7684\u53cc\u680f\u5e03\u5c40\uff0c\u5de6\u4fa7\u53c2\u6570\u8bbe\u7f6e\uff0c\u53f3\u4fa7\u751f\u6210\u7ed3\u679c\uff0c\u6574\u4f53\u89c6\u89c9\u66f4\u514b\u5236\u7edf\u4e00\u3002',
  videoSub:
    '\u53c2\u8003\u56fe\u4e09\u7684\u53cc\u680f\u5e03\u5c40\uff0c\u4fdd\u7559\u89c6\u9891\u7ed3\u679c\u548c\u72b6\u6001\u533a\uff0c\u540c\u65f6\u7edf\u4e00\u5361\u7247\u548c\u5c42\u6b21\u3002',
  newChat: '\u65b0\u5bf9\u8bdd',
  defaultMode: '\u9ed8\u8ba4\u6a21\u5f0f',
  assistant: 'Assistant',
  hello: '\u4f60\u597d',
  assistantReply: '\u4f60\u597d\uff0c\u8bf7\u95ee\u6709\u4ec0\u4e48\u53ef\u4ee5\u5e2e\u52a9\u60a8\u7684\u5417\uff1f',
  inputPlaceholder:
    '\u8f93\u5165\u60a8\u7684\u6d88\u606f...(Enter\u53d1\u9001\uff0cShift+Enter \u6362\u884c)',
  inputHint:
    '\u6309 Enter \u53d1\u9001\uff0cShift+Enter \u6362\u884c\uff0c\u652f\u6301\u62d6\u62fd\u4e0a\u4f20\u56fe\u7247\u6216 Ctrl+V \u7c98\u8d34\u56fe\u7247',
  imageSettings: '\u751f\u6210\u8bbe\u7f6e',
  imageSettingsDesc:
    '\u53c2\u8003\u56fe\u4e8c\u7684\u64cd\u4f5c\u6d41\u7a0b\uff0c\u7edf\u4e00\u4e3a\u66f4\u8f7b\u76c8\u7684\u521b\u4f5c\u5de5\u4f5c\u53f0\u6837\u5f0f\u3002',
  videoSettings: '\u89c6\u9891\u751f\u6210',
  videoSettingsDesc:
    '\u6cbf\u7528\u53c2\u8003\u56fe\u4e09\u7684\u7ed3\u6784\uff0c\u628a\u53c2\u6570\u533a\uff0c\u63d0\u793a\u533a\u548c\u52a8\u4f5c\u6309\u94ae\u505a\u6210\u7edf\u4e00\u5361\u7247\u7cfb\u7edf\u3002',
  uploadRef: '\u4e0a\u4f20\u53c2\u8003\u56fe\uff08\u53ef\u9009\uff09',
  selectImage: '\u9009\u62e9\u56fe\u7247',
  clear: '\u6e05\u7a7a',
  uploadHint:
    '\u5982\u679c\u4f20\u9012\u4e86\u56fe\u751f\u56fe\u6a21\u578b\uff0c\u53c2\u8003\u56fe\u624d\u4f1a\u751f\u6548\uff1b\u5426\u5219\u53ea\u4f20 prompt \u4e5f\u53ef\u4ee5\u751f\u6210\u3002',
  model: '\u6a21\u578b',
  prompt: 'Prompt',
  promptPlaceholder: '\u63cf\u8ff0\u4f60\u60f3\u751f\u6210\u7684\u5185\u5bb9...',
  count: '\u751f\u6210\u6570\u91cf',
  note: '\u8bf4\u660e',
  oneResult: '\u5c06\u4ea7\u751f 1 \u4e2a\u7ed3\u679c',
  imageCountHint:
    '\u6700\u591a\u540c\u65f6\u751f\u6210 4 \u5f20\uff0c\u5efa\u8bae 1-2 \u5f20\u3002',
  createImageTask: '\u521b\u5efa\u751f\u6210\u4efb\u52a1',
  result: '\u751f\u6210\u7ed3\u679c',
  startCreating: '\u7b80\u5355\u4e09\u6b65\u5f00\u59cb\u521b\u4f5c',
  imageResultNote:
    '\u7ed3\u679c\u753b\u5e03\u4fdd\u6301\u6e05\u723d\u7559\u767d\uff0c\u540e\u7eed\u53ef\u4ee5\u65e0\u7f1d\u63a5\u5165\u771f\u5b9e\u751f\u6210\u9884\u89c8\u3002',
  copyLink: '\u590d\u5236\u94fe\u63a5',
  downloadImage: '\u4e0b\u8f7d\u56fe\u7247',
  videoResult: '\u89c6\u9891\u7ed3\u679c',
  downloadVideo: '\u4e0b\u8f7d\u89c6\u9891',
  videoResultNote:
    '\u6587\u751f\u89c6\u9891\uff08T2V\uff09\uff1a\u586b\u5199 Prompt \u5373\u53ef\uff0c\u5206\u8fa8\u7387\u5df2\u6309\u6a21\u578b\u63a8\u8350\uff0c\u65e0\u9700\u4e0a\u4f20\u56fe\u7247\u3002',
  uploadImage: '\u4e0a\u4f20\u56fe\u7247',
  enterPrompt: '\u8f93\u5165\u63d0\u793a\u8bcd',
  generate: '\u751f\u6210',
  videoPromptPlaceholder: '\u63cf\u8ff0\u4f60\u8981\u751f\u6210\u7684\u89c6\u9891\u5185\u5bb9...',
  sizeLabel: '\u5206\u8fa8\u7387 size',
  duration: '\u65f6\u957f',
  currentT2V:
    '\u5f53\u524d\u4e3a\u6587\u751f\u89c6\u9891\uff08T2V\uff09\uff1a\u53ea\u9700\u586b\u5199 Prompt\uff0c\u65e0\u9700\u4e0a\u4f20\u56fe\u7247\u3002',
  videoHint:
    '\u652f\u6301\u8fde\u7eed\u63d0\u4ea4\u591a\u4e2a\u89c6\u9891\u4efb\u52a1\uff1b\u53f3\u4fa7\u7ed3\u679c\u533a\u4f18\u5148\u5c55\u793a\u6700\u65b0\u5b8c\u6210\u7684\u9884\u89c8\uff0c\u82e5\u6709\u66f4\u65b0\u4efb\u52a1\u4ecd\u5728\u751f\u6210\u4f1a\u663e\u793a\u8fdb\u5ea6\u63d0\u793a\u3002',
  createVideoTask: '\u521b\u5efa\u89c6\u9891\u4efb\u52a1',
  status: '\u72b6\u6001',
  statusHint:
    '\u9009\u62e9\u6a21\u578b\u540e\u5c06\u663e\u793a\u8bf4\u660e\uff1b\u63d0\u4ea4\u4efb\u52a1\u540e\u6b64\u5904\u663e\u793a\u8fdb\u5ea6\u63d0\u793a\u3002',
  chatWorkspace: '\u5bf9\u8bdd\u5de5\u4f5c\u533a',
  imageWorkspace: '\u56fe\u7247\u5de5\u4f5c\u533a',
  videoWorkspace: '\u89c6\u9891\u5de5\u4f5c\u533a',
  currentAreaTag: '\u5f53\u524d\u4e3a\u4f4e\u4fdd\u771f\u4f46\u9ad8\u8d28\u611f\u7684\u7ed3\u6784\u7a3f\uff0c\u7528\u4e8e\u7ee7\u7eed\u63a5\u5165\u771f\u5b9e\u529f\u80fd\u3002',
  loadingModels: '\u6b63\u5728\u540c\u6b65\u6a21\u578b\u6807\u7b7e...',
  selectModel: '\u9009\u62e9\u6a21\u578b',
  syncedModels: '\u5df2\u540c\u6b65\u6a21\u578b',
  noTaggedModels: '\u6682\u65e0\u5df2\u6807\u8bb0\u6a21\u578b',
  noTaggedModelsHint:
    '\u8bf7\u5148\u53bb\u300c\u6a21\u578b\u7ba1\u7406\u300d\u4e3a\u6a21\u578b\u6253\u4e0a\u5bf9\u5e94\u6807\u7b7e\uff0c\u521b\u4f5c\u4e2d\u5fc3\u4f1a\u81ea\u52a8\u540c\u6b65\u3002',
  chatEmptyTitle: '\u6682\u65e0\u6587\u672c\u6a21\u578b',
  chatEmptyHint:
    '\u7ed9\u6a21\u578b\u6253\u4e0a\u300c\u6587\u672c\u300d\u6807\u7b7e\u540e\uff0c\u8fd9\u91cc\u4f1a\u81ea\u52a8\u51fa\u73b0\u53ef\u7528\u5bf9\u8bdd\u6a21\u578b\u3002',
  imageEmptyTitle: '\u6682\u65e0\u56fe\u7247\u6a21\u578b',
  imageEmptyHint:
    '\u7ed9\u6a21\u578b\u6253\u4e0a\u300c\u56fe\u7247\u300d\u6807\u7b7e\u540e\uff0c\u56fe\u7247\u521b\u4f5c\u677f\u5757\u4f1a\u81ea\u52a8\u4f7f\u7528\u8fd9\u4e9b\u6a21\u578b\u3002',
  videoEmptyTitle: '\u6682\u65e0\u89c6\u9891\u6a21\u578b',
  videoEmptyHint:
    '\u7ed9\u6a21\u578b\u6253\u4e0a\u300c\u89c6\u9891\u300d\u6807\u7b7e\u540e\uff0c\u89c6\u9891\u521b\u4f5c\u677f\u5757\u4f1a\u81ea\u52a8\u540c\u6b65\u6a21\u578b\u5217\u8868\u3002',
  textTag: '\u6587\u672c',
  imageTag: '\u56fe\u7247',
  videoTag: '\u89c6\u9891',
};

const MODEL_TAG_MAP = {
  chat: TEXT.textTag,
  image: TEXT.imageTag,
  video: TEXT.videoTag,
};

const SECTIONS = [
  {
    key: 'chat',
    title: TEXT.chat,
    subtitle: TEXT.chatSub,
    icon: MessageSquareText,
    accent: 'from-sky-500 via-cyan-500 to-blue-600',
    softAccent: 'from-sky-50 via-cyan-50 to-blue-50',
    tagColor: 'blue',
  },
  {
    key: 'image',
    title: TEXT.image,
    subtitle: TEXT.imageSub,
    icon: ImagePlus,
    accent: 'from-fuchsia-500 via-violet-500 to-indigo-600',
    softAccent: 'from-fuchsia-50 via-violet-50 to-indigo-50',
    tagColor: 'violet',
  },
  {
    key: 'video',
    title: TEXT.video,
    subtitle: TEXT.videoSub,
    icon: Clapperboard,
    accent: 'from-cyan-500 via-sky-500 to-indigo-600',
    softAccent: 'from-cyan-50 via-sky-50 to-indigo-50',
    tagColor: 'cyan',
  },
];

const panelClassName =
  'rounded-[30px] border border-slate-200/80 bg-white/92 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur';

const subtleCardClassName =
  'rounded-[26px] border border-slate-200/80 bg-white/88 shadow-[0_12px_30px_rgba(15,23,42,0.05)]';

const workspaceHeightClassName = 'min-h-[calc(100vh-150px)]';

const toolButtonClassName =
  '!rounded-2xl !border-slate-200 !bg-white/90 !text-slate-600 hover:!bg-slate-50 hover:!text-slate-900';

const stepItems = [TEXT.uploadImage, TEXT.enterPrompt, TEXT.generate];

const splitModelTags = (tags) =>
  String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

const getSectionModels = (models, sectionKey) =>
  (Array.isArray(models) ? models : []).filter((model) => {
    if (!model || model.status !== 1) {
      return false;
    }
    const tags = splitModelTags(model.tags);
    return tags.includes(MODEL_TAG_MAP[sectionKey]);
  });

const toModelOptions = (models) =>
  (Array.isArray(models) ? models : []).map((model) => ({
    label: model.vendor_id
      ? `${model.model_name} · ID ${model.vendor_id}`
      : model.model_name,
    value: model.model_name,
  }));

const SurfaceLabel = ({ children }) => (
  <Typography.Text className='mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400'>
    {children}
  </Typography.Text>
);

const MockField = ({ label, value, hint, tall = false, action }) => (
  <div className='space-y-2'>
    <SurfaceLabel>{label}</SurfaceLabel>
    <div
      className={`rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-sm text-slate-500 ${
        tall ? 'min-h-[110px] py-4' : 'py-3'
      }`}
    >
      <div className='flex items-start justify-between gap-3'>
        <span>{value}</span>
        {action ? (
          <span className='rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 shadow-sm'>
            {action}
          </span>
        ) : null}
      </div>
      {hint ? (
        <Typography.Text className='mt-3 block text-xs leading-5 text-slate-400'>
          {hint}
        </Typography.Text>
      ) : null}
    </div>
  </div>
);

const StatusSteps = () => (
  <div className='mt-6 flex items-center justify-center gap-3 text-xs text-slate-400'>
    {stepItems.map((item, index) => (
      <div key={item} className='flex items-center gap-3'>
        <div className='flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500'>
          {index + 1}
        </div>
        <span>{item}</span>
      </div>
    ))}
  </div>
);

const ModelSelectField = ({
  label,
  value,
  options,
  onChange,
  loading = false,
}) => (
  <div className='space-y-2'>
    <SurfaceLabel>{label}</SurfaceLabel>
    <Select
      filter
      size='large'
      value={value}
      onChange={onChange}
      optionList={options}
      placeholder={TEXT.selectModel}
      loading={loading}
      className='w-full'
    />
  </div>
);

const EmptyModelNotice = ({ title, description, color = 'grey' }) => (
  <div className='rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6'>
    <div className='mb-3 flex items-center gap-2'>
      <Tag color={color}>{TEXT.noTaggedModels}</Tag>
      <Typography.Text strong className='text-slate-800'>
        {title}
      </Typography.Text>
    </div>
    <Typography.Text className='block text-sm leading-7 text-slate-500'>
      {description}
    </Typography.Text>
  </div>
);

const ResultEmpty = ({ icon, title, description, note, actions }) => (
  <div className='flex h-full min-h-[360px] flex-col'>
    <div className='mb-4 flex items-center justify-between gap-3'>
      <Typography.Title heading={5} className='!mb-0 text-slate-900'>
        {title}
      </Typography.Title>
      <div className='flex items-center gap-2'>
        {actions?.map((action) => (
          <Button
            key={action}
            size='small'
            theme='outline'
            className={toolButtonClassName}
          >
            {action}
          </Button>
        ))}
      </div>
    </div>

    {note ? (
      <div className='mb-4 rounded-2xl border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-600'>
        {note}
      </div>
    ) : null}

    <div className='flex flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.9))] px-8 text-center'>
      <div className='mb-5 flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-100 text-slate-400 shadow-inner'>
        {icon}
      </div>
      <Typography.Title heading={3} className='!mb-2 text-slate-800'>
        {title}
      </Typography.Title>
      <Typography.Text className='text-sm leading-7 text-slate-500'>
        {description}
      </Typography.Text>
      <StatusSteps />
    </div>
  </div>
);

const ChatWorkspace = ({
  modelOptions,
  selectedModel,
  onSelectModel,
  loadingModels,
}) => (
  <div className={`flex flex-col gap-4 ${workspaceHeightClassName}`}>
    <Card bordered={false} className={panelClassName} bodyStyle={{ padding: 0 }}>
      <div className='border-b border-slate-100 px-5 py-4'>
        <div className='flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between'>
          <div className='flex min-w-0 flex-1 items-center gap-3'>
            <Button
              theme='light'
              type='primary'
              icon={<Plus size={16} />}
              className='!rounded-2xl !bg-sky-50 !px-4 !text-sky-700 hover:!bg-sky-100'
            >
              {TEXT.newChat}
            </Button>
            <div className='min-w-0 flex-1'>
              <Select
                filter
                size='large'
                value={selectedModel}
                onChange={onSelectModel}
                optionList={modelOptions}
                placeholder={TEXT.selectModel}
                loading={loadingModels}
                className='w-full'
              />
            </div>
            <div className='rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm'>
              {TEXT.defaultMode}
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              icon={<Eye size={15} />}
              theme='outline'
              size='small'
              className={toolButtonClassName}
            />
            <Button
              icon={<SlidersHorizontal size={15} />}
              theme='outline'
              size='small'
              className={toolButtonClassName}
            />
          </div>
        </div>
      </div>

      <div className='relative overflow-hidden px-5 pb-5 pt-6'>
        <div className='absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_left_top,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_right_top,rgba(129,140,248,0.12),transparent_35%)]' />
        <div className='relative flex min-h-[calc(100vh-290px)] flex-col justify-between'>
          <div className='space-y-8'>
            {!loadingModels && modelOptions.length === 0 ? (
              <EmptyModelNotice
                title={TEXT.chatEmptyTitle}
                description={TEXT.chatEmptyHint}
                color='blue'
              />
            ) : null}
            <div className='flex justify-end'>
              <div className='max-w-[320px] text-right'>
                <div className='mb-2 flex items-center justify-end gap-3 text-sm text-slate-400'>
                  <span>google_QaXdNZGh</span>
                  <span>2024-05-14 4:52pm</span>
                  <Avatar size='small' color='yellow'>
                    G
                  </Avatar>
                </div>
                <div className='ml-auto inline-flex rounded-[22px] border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-700 shadow-sm'>
                  {TEXT.hello}
                </div>
                <div className='mt-3 flex justify-end gap-3 text-slate-300'>
                  <Wand2 size={15} />
                  <ImageIcon size={15} />
                  <Sparkles size={15} />
                </div>
              </div>
            </div>

            <div className='max-w-[420px]'>
              <div className='mb-3 flex items-center gap-3 text-sm text-slate-400'>
                <Avatar size='small' color='blue'>
                  A
                </Avatar>
                <span className='font-medium text-slate-700'>{TEXT.assistant}</span>
                <span>2024-05-14 4:52pm</span>
              </div>
              <div className='rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-sm leading-7 text-slate-700 shadow-sm'>
                {TEXT.assistantReply}
              </div>
              <div className='mt-3 flex items-center gap-3 text-slate-300'>
                <Wand2 size={15} />
                <ImageIcon size={15} />
                <Sparkles size={15} />
                <Settings2 size={15} />
              </div>
            </div>
          </div>

          <div className='mt-10 rounded-[30px] border border-slate-200 bg-white p-3 shadow-[0_16px_36px_rgba(15,23,42,0.08)]'>
            <div className='mb-3 flex items-center gap-3'>
              <div className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-sky-600 shadow-sm'>
                default
              </div>
              <div className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 shadow-sm'>
                1x
              </div>
              <div className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 shadow-sm'>
                {selectedModel || TEXT.selectModel}
              </div>
            </div>
            <div className='flex items-end gap-3'>
              <div className='min-h-[84px] flex-1 rounded-[24px] border border-slate-200 bg-slate-50/80 px-5 py-4 text-sm text-slate-400'>
                {TEXT.inputPlaceholder}
              </div>
              <Button
                theme='solid'
                type='primary'
                icon={<Upload size={18} />}
                className='!h-12 !w-12 !rounded-2xl !bg-slate-100 !text-sky-600'
              />
              <Button
                theme='solid'
                type='primary'
                icon={<Send size={18} />}
                className='!h-12 !w-12 !rounded-2xl !bg-sky-500 !text-white hover:!bg-sky-600'
              />
            </div>
            <Typography.Text className='mt-3 block text-xs text-slate-400'>
              {TEXT.inputHint}
            </Typography.Text>
          </div>
        </div>
      </div>
    </Card>
  </div>
);

const ImageWorkspace = ({
  modelOptions,
  selectedModel,
  onSelectModel,
  loadingModels,
}) => (
  <div
    className={`grid gap-4 xl:grid-cols-[minmax(520px,1.15fr)_minmax(480px,1fr)] ${workspaceHeightClassName}`}
  >
    <Card bordered={false} className={`${panelClassName} h-full`}>
      <div className='mb-5 flex items-center justify-between gap-3'>
        <div>
          <Typography.Title heading={4} className='!mb-1'>
            {TEXT.imageSettings}
          </Typography.Title>
          <Typography.Text className='text-sm text-slate-500'>
            {TEXT.imageSettingsDesc}
          </Typography.Text>
        </div>
        <Tag color='violet'>{TEXT.image}</Tag>
      </div>

      <div className='space-y-4'>
        {!loadingModels && modelOptions.length === 0 ? (
          <EmptyModelNotice
            title={TEXT.imageEmptyTitle}
            description={TEXT.imageEmptyHint}
            color='violet'
          />
        ) : null}
        <MockField
          label={TEXT.uploadRef}
          value={TEXT.selectImage}
          action={TEXT.clear}
          hint={TEXT.uploadHint}
        />
        <ModelSelectField
          label={TEXT.model}
          value={selectedModel}
          options={modelOptions}
          onChange={onSelectModel}
          loading={loadingModels}
        />
        <MockField label={TEXT.prompt} value={TEXT.promptPlaceholder} tall />
        <div className='grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]'>
          <MockField label={TEXT.count} value='1' />
          <MockField
            label={TEXT.note}
            value={TEXT.oneResult}
            hint={TEXT.imageCountHint}
          />
        </div>
        <div className='rounded-[24px] bg-[linear-gradient(90deg,#4338ca,#9333ea,#c026d3)] p-[1px] shadow-[0_16px_36px_rgba(139,92,246,0.28)]'>
          <div className='rounded-[23px] bg-white/10 p-[1px]'>
            <Button
              block
              theme='solid'
              type='primary'
              className='!h-11 !rounded-[22px] !border-0 !bg-transparent !text-white hover:!bg-white/5'
            >
              {TEXT.createImageTask}
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <Card bordered={false} className={`${panelClassName} h-full`}>
      <ResultEmpty
        title={TEXT.result}
        description={TEXT.startCreating}
        note={TEXT.imageResultNote}
        actions={[TEXT.copyLink, TEXT.downloadImage, TEXT.clear]}
        icon={<ImageIcon size={24} />}
      />
    </Card>
  </div>
);

const VideoWorkspace = ({
  modelOptions,
  selectedModel,
  onSelectModel,
  loadingModels,
}) => (
  <div
    className={`grid gap-4 xl:grid-cols-[minmax(520px,1.15fr)_minmax(480px,1fr)] ${workspaceHeightClassName}`}
  >
    <div className='flex h-full flex-col gap-4'>
      <Card bordered={false} className={panelClassName}>
        <div className='mb-5 flex items-center justify-between gap-3'>
          <div>
            <Typography.Title heading={4} className='!mb-1'>
              {TEXT.videoSettings}
            </Typography.Title>
            <Typography.Text className='text-sm text-slate-500'>
              {TEXT.videoSettingsDesc}
            </Typography.Text>
          </div>
          <Tag color='cyan'>{TEXT.video}</Tag>
        </div>

        <div className='space-y-4'>
          {!loadingModels && modelOptions.length === 0 ? (
            <EmptyModelNotice
              title={TEXT.videoEmptyTitle}
              description={TEXT.videoEmptyHint}
              color='cyan'
            />
          ) : null}
          <ModelSelectField
            label={TEXT.model}
            value={selectedModel}
            options={modelOptions}
            onChange={onSelectModel}
            loading={loadingModels}
          />
          <MockField
            label={TEXT.prompt}
            value={TEXT.videoPromptPlaceholder}
            tall
          />
          <div className='grid gap-4 md:grid-cols-2'>
            <MockField
              label={TEXT.sizeLabel}
              value='720\u00d71280\uff08\u7ad6\u5c4f\uff09'
            />
            <MockField label={TEXT.duration} value='8 \u79d2\uff08\u56fa\u5b9a\uff09' />
          </div>
          <div className='space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/85 px-4 py-4 text-sm text-slate-500'>
            <Typography.Text className='block text-sm text-slate-700'>
              {TEXT.currentT2V}
            </Typography.Text>
            <Typography.Text className='block text-xs leading-6 text-slate-400'>
              {TEXT.videoHint}
            </Typography.Text>
          </div>
          <div className='rounded-[24px] bg-[linear-gradient(90deg,#38bdf8,#3b82f6,#6366f1)] p-[1px] shadow-[0_16px_36px_rgba(59,130,246,0.26)]'>
            <div className='rounded-[23px] bg-white/10 p-[1px]'>
              <Button
                block
                theme='solid'
                type='primary'
                className='!h-11 !rounded-[22px] !border-0 !bg-transparent !text-white hover:!bg-white/5'
              >
                {TEXT.createVideoTask}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <div className='flex h-full flex-col gap-4'>
      <Card bordered={false} className={`${panelClassName} flex-1`}>
        <ResultEmpty
          title={TEXT.videoResult}
          description={TEXT.startCreating}
          note={TEXT.videoResultNote}
          actions={[TEXT.copyLink, TEXT.downloadVideo, TEXT.clear]}
          icon={<Clapperboard size={24} />}
        />
      </Card>

      <Card bordered={false} className={subtleCardClassName}>
        <SurfaceLabel>{TEXT.status}</SurfaceLabel>
        <Typography.Text className='text-sm leading-7 text-slate-500'>
          {TEXT.statusHint}
        </Typography.Text>
      </Card>
    </div>
  </div>
);

const CreationCenter = () => {
  const [activeSection, setActiveSection] = useState('chat');
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [selectedModels, setSelectedModels] = useState({
    chat: undefined,
    image: undefined,
    video: undefined,
  });

  useEffect(() => {
    let mounted = true;

    const loadModels = async () => {
      setLoadingModels(true);
      try {
        const res = await API.get('/api/models/?page_size=1000');
        const { success, data } = res.data || {};
        if (!mounted) {
          return;
        }
        if (success) {
          const items = data?.items || data || [];
          setModels(Array.isArray(items) ? items : []);
        } else {
          setModels([]);
        }
      } catch (_) {
        if (mounted) {
          setModels([]);
        }
      } finally {
        if (mounted) {
          setLoadingModels(false);
        }
      }
    };

    loadModels();

    return () => {
      mounted = false;
    };
  }, []);

  const sectionModels = useMemo(
    () => ({
      chat: getSectionModels(models, 'chat'),
      image: getSectionModels(models, 'image'),
      video: getSectionModels(models, 'video'),
    }),
    [models],
  );

  const sectionOptions = useMemo(
    () => ({
      chat: toModelOptions(sectionModels.chat),
      image: toModelOptions(sectionModels.image),
      video: toModelOptions(sectionModels.video),
    }),
    [sectionModels],
  );

  useEffect(() => {
    setSelectedModels((prev) => {
      const next = { ...prev };
      ['chat', 'image', 'video'].forEach((key) => {
        const options = sectionOptions[key];
        const currentExists = options.some(
          (option) => option.value === prev[key],
        );
        next[key] = currentExists ? prev[key] : options[0]?.value;
      });
      return next;
    });
  }, [sectionOptions]);

  const currentSection =
    SECTIONS.find((section) => section.key === activeSection) || SECTIONS[0];

  const handleSelectModel = (sectionKey, value) => {
    setSelectedModels((prev) => ({
      ...prev,
      [sectionKey]: value,
    }));
  };

  return (
    <div className='min-h-[calc(100vh-66px)] bg-[linear-gradient(180deg,#f8fafc_0%,#edf4ff_38%,#f8fafc_100%)] px-3 pb-3 pt-[72px] lg:px-4'>
      <div className='mx-auto flex w-full max-w-none flex-col gap-4'>
        <div className='grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]'>
          <Card
            bordered={false}
            className='rounded-[30px] border border-slate-200/80 bg-white/90 shadow-[0_18px_48px_rgba(15,23,42,0.06)]'
            bodyStyle={{ padding: 18, height: '100%' }}
          >
            <div className='mb-4 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-4 py-4 shadow-sm'>
              <Tag color='blue' className='!rounded-full !px-3 !py-1'>
                {TEXT.creationCenter}
              </Tag>
              <Typography.Title heading={4} className='!mb-1 !mt-3 text-slate-900'>
                {TEXT.unifiedStudio}
              </Typography.Title>
              <Typography.Paragraph className='!mb-0 text-sm leading-6 text-slate-500'>
                {TEXT.layoutHint}
              </Typography.Paragraph>
            </div>

            <div className='mb-4 flex items-center justify-between gap-3 text-slate-700'>
              <div className='flex items-center gap-2'>
                <LayoutPanelLeft size={18} />
                <Typography.Text strong>{TEXT.switchSection}</Typography.Text>
              </div>
              <Tag color={currentSection.tagColor}>{currentSection.title}</Tag>
            </div>

            <Typography.Paragraph className='!mb-4 text-sm leading-6 text-slate-500'>
              {TEXT.switchHint}
            </Typography.Paragraph>

            <div className='flex flex-col gap-3'>
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.key;
                return (
                  <button
                    key={section.key}
                    type='button'
                    onClick={() => setActiveSection(section.key)}
                    className={`rounded-[24px] p-[1px] text-left transition-all duration-200 ${
                      isActive
                        ? `bg-gradient-to-r ${section.accent} shadow-[0_14px_30px_rgba(15,23,42,0.12)]`
                        : 'bg-slate-200/80 hover:bg-slate-300/80'
                    }`}
                  >
                    <div
                      className={`rounded-[23px] px-4 py-4 ${
                        isActive
                          ? 'bg-slate-950 text-white'
                          : 'bg-white text-slate-800'
                      }`}
                    >
                      <div className='flex items-start gap-3'>
                        <div
                          className={`mt-0.5 flex h-11 w-11 items-center justify-center rounded-[18px] ${
                            isActive
                              ? 'bg-white/12 text-white'
                              : `bg-gradient-to-r ${section.softAccent} text-slate-700`
                          }`}
                        >
                          <Icon size={18} />
                        </div>
                        <div className='min-w-0'>
                          <div className='text-sm font-semibold'>
                            {section.title}
                          </div>
                          <div
                            className={`mt-1 text-xs leading-6 ${
                              isActive ? 'text-white/72' : 'text-slate-500'
                            }`}
                          >
                            {section.subtitle}
                          </div>
                          <div className='mt-3 flex items-center gap-2'>
                            <Tag
                              size='small'
                              color={isActive ? 'white' : section.tagColor}
                            >
                              {loadingModels
                                ? TEXT.loadingModels
                                : `${TEXT.syncedModels} ${sectionOptions[section.key].length}`}
                            </Tag>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className='min-w-0'>
            <Spin spinning={loadingModels}>
              {activeSection === 'chat' ? (
                <ChatWorkspace
                  modelOptions={sectionOptions.chat}
                  selectedModel={selectedModels.chat}
                  onSelectModel={(value) => handleSelectModel('chat', value)}
                  loadingModels={loadingModels}
                />
              ) : null}
              {activeSection === 'image' ? (
                <ImageWorkspace
                  modelOptions={sectionOptions.image}
                  selectedModel={selectedModels.image}
                  onSelectModel={(value) => handleSelectModel('image', value)}
                  loadingModels={loadingModels}
                />
              ) : null}
              {activeSection === 'video' ? (
                <VideoWorkspace
                  modelOptions={sectionOptions.video}
                  selectedModel={selectedModels.video}
                  onSelectModel={(value) => handleSelectModel('video', value)}
                  loadingModels={loadingModels}
                />
              ) : null}
            </Spin>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreationCenter;
