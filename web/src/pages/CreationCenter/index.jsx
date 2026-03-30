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

import React, { useState } from 'react';
import { Button, Card, Tag, Typography } from '@douyinfe/semi-ui';
import {
  Clapperboard,
  ImagePlus,
  LayoutPanelLeft,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CREATION_SECTIONS = [
  {
    key: 'chat',
    titleKey: '智能对话',
    descriptionKey: '大模型对话工作区骨架',
    icon: MessageSquareText,
  },
  {
    key: 'image',
    titleKey: '图片创作',
    descriptionKey: '图片生成工作区骨架',
    icon: ImagePlus,
  },
  {
    key: 'video',
    titleKey: '视频创作',
    descriptionKey: '视频生成工作区骨架',
    icon: Clapperboard,
  },
];

const CHAT_BLOCKS = [
  '顶部标题栏',
  '模型 / 模式占位条',
  '聊天内容区',
  '底部输入区',
];

const CreationWorkspace = ({ activeSection, t }) => {
  if (activeSection === 'chat') {
    return (
      <div className='flex h-full min-h-[620px] flex-col gap-4'>
        <Card
          bordered={false}
          className='rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm'
        >
          <div className='flex items-center justify-between gap-3'>
            <div>
              <Typography.Title heading={5} className='!mb-1'>
                {t('对话主工作区')}
              </Typography.Title>
              <Typography.Text className='text-sm text-slate-500'>
                {t('用于承载模型切换、会话内容和输入操作。')}
              </Typography.Text>
            </div>
            <Tag color='cyan'>{t('低保真骨架')}</Tag>
          </div>
        </Card>

        <Card
          bordered={false}
          className='rounded-3xl border border-dashed border-slate-300 bg-slate-50/85 shadow-none'
        >
          <div className='flex flex-wrap gap-3'>
            {CHAT_BLOCKS.map((block) => (
              <div
                key={block}
                className='rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm'
              >
                {t(block)}
              </div>
            ))}
          </div>
        </Card>

        <Card
          bordered={false}
          className='flex-1 rounded-3xl border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.9))] shadow-none'
          bodyStyle={{ height: '100%' }}
        >
          <div className='flex h-full min-h-[420px] flex-col justify-between gap-4'>
            <div className='flex-1 rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-6'>
              <div className='mb-4 flex items-center gap-2 text-slate-400'>
                <Sparkles size={16} />
                <Typography.Text className='text-sm text-slate-500'>
                  {t('会话内容占位')}
                </Typography.Text>
              </div>
            </div>
            <div className='rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm'>
              <Typography.Text className='text-sm text-slate-500'>
                {t('输入区占位')}
              </Typography.Text>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const titleKey = activeSection === 'image' ? '图片创作工作区' : '视频创作工作区';
  const descriptionKey =
    activeSection === 'image'
      ? '左侧用于放置生成配置，右侧用于放置结果预览。'
      : '左侧用于放置视频配置，右侧用于放置生成结果与状态。';

  return (
    <div className='flex h-full min-h-[620px] flex-col gap-4'>
      <Card
        bordered={false}
        className='rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm'
      >
        <div className='flex items-center justify-between gap-3'>
          <div>
            <Typography.Title heading={5} className='!mb-1'>
              {t(titleKey)}
            </Typography.Title>
            <Typography.Text className='text-sm text-slate-500'>
              {t(descriptionKey)}
            </Typography.Text>
          </div>
          <Tag color={activeSection === 'image' ? 'lime' : 'violet'}>
            {t('低保真骨架')}
          </Tag>
        </div>
      </Card>

      <div className='grid flex-1 gap-4 xl:grid-cols-[minmax(420px,1.05fr)_minmax(420px,1fr)]'>
        {[
          { key: 'config', titleKey: '配置区', sideKey: '左栏' },
          { key: 'result', titleKey: '结果区', sideKey: '右栏' },
        ].map((block, index) => (
          <Card
            key={block.key}
            bordered={false}
            className='rounded-3xl border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] shadow-none'
            bodyStyle={{ height: '100%' }}
          >
            <div className='flex h-full min-h-[520px] flex-col gap-4'>
              <div className='flex items-center justify-between gap-3'>
                <Typography.Title heading={6} className='!mb-0'>
                  {t(block.titleKey)}
                </Typography.Title>
                <Tag size='small' color={index === 0 ? 'blue' : 'grey'}>
                  {t(block.sideKey)}
                </Tag>
              </div>

              <div className='rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm'>
                {t(index === 0 ? '顶部标题栏' : '结果标题栏')}
              </div>

              <div className='flex-1 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-500'>
                {t(index === 0 ? '主要内容占位区' : '结果展示占位区')}
              </div>

              <div className='grid gap-3 md:grid-cols-2'>
                <div className='rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm'>
                  {t(index === 0 ? '参数卡片占位' : '状态卡片占位')}
                </div>
                <div className='rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm'>
                  {t(index === 0 ? '附加操作占位' : '下载 / 操作占位')}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const CreationCenter = () => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('chat');

  const currentSection =
    CREATION_SECTIONS.find((section) => section.key === activeSection) ||
    CREATION_SECTIONS[0];

  return (
    <div className='min-h-[calc(100vh-66px)] bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_46%,#f8fafc_100%)] px-4 pb-6 pt-[76px] lg:px-6'>
      <div className='mx-auto flex w-full max-w-[1600px] flex-col gap-5'>
        <Card
          bordered={false}
          className='overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/85 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur'
          bodyStyle={{ padding: 0 }}
        >
          <div className='relative overflow-hidden'>
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(129,140,248,0.16),transparent_28%)]' />
            <div className='relative flex flex-col gap-5 px-6 py-6 lg:px-8 lg:py-7'>
              <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
                <div className='max-w-3xl'>
                  <Tag color='blue' className='!rounded-full !px-3 !py-1'>
                    {t('创作工作台')}
                  </Tag>
                  <Typography.Title heading={2} className='!mb-2 !mt-4 text-slate-900'>
                    {t('创作中心')}
                  </Typography.Title>
                  <Typography.Paragraph className='!mb-0 max-w-2xl text-sm leading-7 text-slate-600'>
                    {t(
                      '面向创作任务的独立工作区，先完成页面骨架与布局分区，后续再接入真实功能。',
                    )}
                  </Typography.Paragraph>
                </div>

                <div className='rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-4 text-sm text-slate-500 shadow-sm'>
                  <div className='mb-1 font-medium text-slate-700'>
                    {t('当前为低保真占位页面，用于确认信息架构和版块布局。')}
                  </div>
                  <div>{t('工作区')}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className='grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]'>
          <Card
            bordered={false}
            className='rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_14px_40px_rgba(15,23,42,0.06)]'
            bodyStyle={{ padding: 20 }}
          >
            <div className='mb-4 flex items-center gap-2 text-slate-700'>
              <LayoutPanelLeft size={18} />
              <Typography.Text strong>{t('切换板块')}</Typography.Text>
            </div>
            <Typography.Paragraph className='!mb-4 text-sm text-slate-500'>
              {t('选择对应板块后，在右侧查看骨架布局。')}
            </Typography.Paragraph>

            <div className='flex flex-col gap-3'>
              {CREATION_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.key;

                return (
                  <Button
                    key={section.key}
                    theme={isActive ? 'solid' : 'light'}
                    type={isActive ? 'primary' : 'tertiary'}
                    onClick={() => setActiveSection(section.key)}
                    className={`!h-auto !justify-start !rounded-2xl !px-4 !py-4 ${
                      isActive
                        ? '!bg-slate-900 !text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]'
                        : '!bg-slate-50 !text-slate-700 hover:!bg-white'
                    }`}
                  >
                    <div className='flex items-start gap-3 text-left'>
                      <div
                        className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${
                          isActive
                            ? 'bg-white/12 text-white'
                            : 'bg-white text-slate-700 shadow-sm'
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className='min-w-0'>
                        <div className='text-sm font-semibold'>
                          {t(section.titleKey)}
                        </div>
                        <div
                          className={`mt-1 text-xs leading-5 ${
                            isActive ? 'text-white/72' : 'text-slate-500'
                          }`}
                        >
                          {t(section.descriptionKey)}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </Card>

          <div className='min-w-0'>
            <div className='mb-4 flex items-center justify-between gap-3'>
              <div>
                <Typography.Title heading={4} className='!mb-1'>
                  {t(currentSection.titleKey)}
                </Typography.Title>
                <Typography.Text className='text-sm text-slate-500'>
                  {t(currentSection.descriptionKey)}
                </Typography.Text>
              </div>
              <Tag color='blue' className='!rounded-full !px-3 !py-1'>
                {t('工作区')}
              </Tag>
            </div>

            <CreationWorkspace activeSection={activeSection} t={t} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreationCenter;
