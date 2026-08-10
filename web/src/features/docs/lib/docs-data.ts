/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) a later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

// In-site product documentation (OriginFlow proprietary docs).
// This is the framework scaffold: topics and section headings are defined
// here; body copy is intentionally placeholder and will be filled in later.

export interface DocSection {
  heading: string
  body: string
}

export interface DocTopic {
  slug: string
  title: string
  summary: string
  sections: DocSection[]
}

export const DOC_TOPICS: DocTopic[] = [
  {
    slug: 'introduction',
    title: '项目介绍',
    summary: '了解元点流商 OriginFlow 的定位、核心能力与适用场景。',
    sections: [
      {
        heading: '什么是 OriginFlow',
        body: '（内容待补充）OriginFlow 是基于 New-API 二次开发的统一 AI 能力网关，提供标准化、统一协议的模型接入能力。',
      },
      {
        heading: '核心能力',
        body: '（内容待补充）统一协议接入、API Key 管理、自动分组（Auto group）、配额与计费、模型市场等。',
      },
      {
        heading: '适用场景',
        body: '（内容待补充）AI 应用基础设施、数字资产管理、多模型统一调度等。',
      },
    ],
  },
  {
    slug: 'quick-start',
    title: '快速开始',
    summary: '几步上手：获取密钥并发起第一次请求。',
    sections: [
      { heading: '获取 API Key', body: '（内容待补充）在控制台「API Keys」中创建密钥，并配置自动分组等选项。' },
      { heading: '发起第一次请求', body: '（内容待补充）使用统一协议向网关发起请求。' },
      { heading: '常见配置', body: '（内容待补充）基础参数、超时与重试策略。' },
    ],
  },
  {
    slug: 'features',
    title: '功能说明',
    summary: '逐项说明平台的功能模块。',
    sections: [
      {
        heading: 'API Key 与自动分组',
        body: '（内容待补充）支持 per-token Auto group 选择、顺序编排与比例可视化；系统可配置 MaxTokenAutoGroups 上限。',
      },
      { heading: '模型市场', body: '（内容待补充）公开模型目录与商店化展示。' },
      { heading: '配额与计费', body: '（内容待补充）配额、计费分组与对账。' },
    ],
  },
  {
    slug: 'api',
    title: 'API 文档',
    summary: '接口鉴权、调用方式与示例。',
    sections: [
      { heading: '鉴权方式', body: '（内容待补充）Authorization: Bearer <API_KEY>' },
      { heading: '接口列表', body: '（内容待补充）' },
      { heading: '调用示例', body: '（内容待补充）' },
    ],
  },
  {
    slug: 'installation',
    title: '安装部署',
    summary: '自部署与基础运维指引。',
    sections: [
      { heading: '环境要求', body: '（内容待补充）' },
      { heading: '部署方式', body: '（内容待补充）' },
      { heading: '基础运维', body: '（内容待补充）' },
    ],
  },
]

export function getDocTopic(slug: string): DocTopic | undefined {
  return DOC_TOPICS.find((t) => t.slug === slug)
}
