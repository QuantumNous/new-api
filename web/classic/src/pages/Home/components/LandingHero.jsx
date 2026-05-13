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
import { Button, Card, Tag, Typography } from '@douyinfe/semi-ui';
import { IconCopy, IconFile, IconPlay } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import { heroMetrics } from '../landingData';

const { Text, Title, Paragraph } = Typography;

const LandingHero = ({
  docsLink,
  endpoint,
  onCopyBaseURL,
  serverAddress,
  user,
  isSelfUseMode,
}) => {
  const primaryPath = user
    ? '/console/token'
    : isSelfUseMode
      ? '/login'
      : '/register';
  const primaryText = user
    ? '创建令牌'
    : isSelfUseMode
      ? '登录使用'
      : '免费开始';

  return (
    <section className='relative overflow-hidden px-4 py-14 sm:px-6 lg:px-8 lg:py-20'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,0.12),transparent_28%)]' />
      <div className='relative mx-auto grid w-full max-w-7xl items-stretch gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center'>
        <div className='min-w-0'>
          <Tag color='cyan' size='large' shape='circle'>
            统一接入 · 控制台管理 · OpenAI 兼容
          </Tag>
          <Title
            heading={1}
            className='!mb-5 !mt-6 max-w-4xl break-words !text-3xl !font-black !leading-tight !text-semi-color-text-0 sm:!text-4xl md:!text-6xl'
          >
            一个 API 聚合多类 AI 模型能力
          </Title>
          <Paragraph className='max-w-2xl !text-base !leading-8 !text-semi-color-text-1 md:!text-lg'>
            使用统一 Base URL 和统一令牌接入文本、图像、视频、编码等能力，
            在控制台集中管理模型、用量、令牌和请求记录。
          </Paragraph>

          <div className='mt-7 flex flex-col gap-3 sm:flex-row sm:items-center'>
            <Link to={primaryPath}>
              <Button
                size='large'
                theme='solid'
                type='primary'
                icon={<IconPlay />}
              >
                {primaryText}
              </Button>
            </Link>
            {docsLink && (
              <Button
                size='large'
                icon={<IconFile />}
                onClick={() => window.open(docsLink, '_blank')}
              >
                查看 API 文档
              </Button>
            )}
          </div>

          <div className='mt-8 grid grid-cols-2 gap-3 md:grid-cols-4'>
            {heroMetrics.map((metric) => (
              <div
                key={metric.label}
                className='rounded-2xl border border-semi-color-border bg-semi-color-bg-1 p-4'
              >
                <Text className='block !text-xs !text-semi-color-text-2'>
                  {metric.label}
                </Text>
                <Text className='mt-1 block !font-semibold !text-semi-color-text-0'>
                  {metric.value}
                </Text>
              </div>
            ))}
          </div>
        </div>

        <Card
          bordered
          className='!w-full !max-w-full min-w-0 !rounded-3xl !border-semi-color-border !bg-semi-color-bg-1 !shadow-xl'
          bodyStyle={{ padding: 0, minWidth: 0 }}
        >
          <div className='border-b border-semi-color-border px-5 py-4'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <Text className='block !font-semibold !text-semi-color-text-0'>
                  API 请求预览
                </Text>
                <Text className='!text-xs !text-semi-color-text-2'>
                  静态示例，不发起真实请求
                </Text>
              </div>
              <Tag color='green'>Ready</Tag>
            </div>
          </div>
          <div className='space-y-4 p-4 sm:p-5'>
            <div className='rounded-2xl bg-semi-color-fill-0 p-4'>
              <Text className='block !text-xs !text-semi-color-text-2'>
                Base URL
              </Text>
              <div className='mt-2 flex min-w-0 items-center gap-2'>
                <code className='min-w-0 flex-1 truncate rounded-lg bg-semi-color-bg-2 px-3 py-2 text-sm text-semi-color-text-0'>
                  {serverAddress}
                </code>
                <Button icon={<IconCopy />} onClick={onCopyBaseURL} />
              </div>
            </div>

            <div className='rounded-2xl bg-[#0b1120] p-4 text-xs text-[#f8fafc] sm:text-sm'>
              <div className='mb-3 flex items-center gap-2 text-xs text-[#94a3b8]'>
                <span className='h-2 w-2 rounded-full bg-[#fb7185]' />
                <span className='h-2 w-2 rounded-full bg-[#fbbf24]' />
                <span className='h-2 w-2 rounded-full bg-[#34d399]' />
                <span className='ml-2'>compatible-request.js</span>
              </div>
              <pre className='m-0 overflow-x-auto whitespace-pre-wrap break-words font-mono leading-6 !text-[#f8fafc]'>
                {`client.chat.completions.create({
  model: "your-model",
  endpoint: "${endpoint}",
  messages: [
    { role: "user", content: "Hello" }
  ]
})`}
              </pre>
            </div>

            <div className='grid grid-cols-3 gap-3'>
              {['Text', 'Image', 'Video'].map((item) => (
                <div
                  key={item}
                  className='rounded-2xl border border-semi-color-border p-3 text-center'
                >
                  <Text className='!text-sm !font-semibold !text-semi-color-text-0'>
                    {item}
                  </Text>
                  <Text className='mt-1 block !text-xs !text-semi-color-text-2'>
                    可配置
                  </Text>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default LandingHero;
