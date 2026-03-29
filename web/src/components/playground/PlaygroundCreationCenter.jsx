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
import { Card, Typography } from '@douyinfe/semi-ui';
import { Clapperboard, ImagePlus, MessageSquareText, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PLAYGROUND_MODES } from '../../helpers';

const MODE_CARDS = {
  [PLAYGROUND_MODES.CHAT]: {
    icon: MessageSquareText,
    titleKey: '智能对话',
    descriptionKey: '适合长上下文、多轮追问、提示词调试和结构化输出。',
    accent: 'from-sky-500 via-cyan-400 to-blue-500',
  },
  [PLAYGROUND_MODES.IMAGE]: {
    icon: ImagePlus,
    titleKey: '图片创作',
    descriptionKey: '围绕提示词、尺寸比例和参考图来生成或编辑图像。',
    accent: 'from-amber-500 via-orange-400 to-rose-400',
  },
  [PLAYGROUND_MODES.VIDEO]: {
    icon: Clapperboard,
    titleKey: '视频创作',
    descriptionKey: '聚焦时长、清晰度和参考模式，快速组织视频生成任务。',
    accent: 'from-fuchsia-500 via-rose-500 to-orange-400',
  },
};

const PlaygroundCreationCenter = ({
  playgroundMode,
  onModeChange,
  modeCounts,
  currentModel,
}) => {
  const { t } = useTranslation();

  return (
    <Card
      bordered={false}
      bodyStyle={{ padding: 0 }}
      className='overflow-hidden rounded-3xl shadow-[0_24px_80px_rgba(15,23,42,0.12)]'
    >
      <div className='relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(240,249,255,0.94)_35%,_rgba(255,247,237,0.92)_100%)]'>
        <div className='absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(249,115,22,0.10))]' />
        <div className='relative px-5 py-5 lg:px-7 lg:py-6'>
          <div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
            <div className='max-w-2xl'>
              <div className='inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm'>
                <Sparkles size={14} />
                {t('创作中心')}
              </div>
              <Typography.Title heading={3} className='!mb-2 !mt-3 text-slate-900'>
                {t('在一个操练场里切换对话、图片和视频创作')}
              </Typography.Title>
              <Typography.Paragraph className='!mb-0 max-w-xl text-sm leading-6 text-slate-600'>
                {t('下方工作区继续复用现有操练场能力，你只需要在这里选择创作模式，系统会优先为你对齐合适的模型与配置。')}
              </Typography.Paragraph>
            </div>
            <div className='rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-lg'>
              <div className='text-xs uppercase tracking-[0.24em] text-white/60'>
                {t('当前模型')}
              </div>
              <div className='mt-1 max-w-[220px] truncate text-sm font-medium'>
                {currentModel || t('未选择模型')}
              </div>
            </div>
          </div>

          <div className='mt-5 grid gap-3 lg:grid-cols-3'>
            {Object.entries(MODE_CARDS).map(([mode, config]) => {
              const Icon = config.icon;
              const isActive = playgroundMode === mode;
              const count = modeCounts?.[mode] || 0;

              return (
                <button
                  key={mode}
                  type='button'
                  onClick={() => onModeChange(mode)}
                  className={`group rounded-3xl p-[1px] text-left transition-all duration-200 ${
                    isActive
                      ? `bg-gradient-to-br ${config.accent} shadow-[0_18px_40px_rgba(15,23,42,0.16)]`
                      : 'bg-white/80 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,23,42,0.10)]'
                  }`}
                >
                  <div
                    className={`h-full rounded-[23px] px-4 py-4 ${
                      isActive
                        ? 'bg-slate-950 text-white'
                        : 'bg-white/90 text-slate-900'
                    }`}
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                          isActive
                            ? 'bg-white/12 text-white'
                            : `bg-gradient-to-br ${config.accent} text-white`
                        }`}
                      >
                        <Icon size={20} />
                      </div>
                      <div
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          isActive
                            ? 'bg-white/10 text-white/80'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {t('可用模型')} {count}
                      </div>
                    </div>
                    <div className='mt-4'>
                      <div className='text-base font-semibold'>{t(config.titleKey)}</div>
                      <Typography.Paragraph
                        className={`!mb-0 !mt-2 text-sm leading-6 ${
                          isActive ? '!text-white/78' : '!text-slate-600'
                        }`}
                      >
                        {t(config.descriptionKey)}
                      </Typography.Paragraph>
                    </div>
                    <div
                      className={`mt-4 text-xs font-medium ${
                        isActive ? 'text-white/72' : 'text-slate-500'
                      }`}
                    >
                      {isActive ? t('当前模式') : t('切换到此模式')}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PlaygroundCreationCenter;
