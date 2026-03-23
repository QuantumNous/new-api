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

import React, { useContext, useMemo } from 'react';
import {
  Banner,
  Card,
  Collapse,
  Space,
  Tabs,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconCode,
  IconKey,
  IconLink,
  IconPlay,
  IconSetting,
  IconTerminal,
  IconUser,
} from '@douyinfe/semi-icons';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { useTranslation } from 'react-i18next';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

const stepCards = [
  {
    title: '注册账号',
    subtitle: '创建您的平台账号',
    icon: <IconUser size='large' />,
  },
  {
    title: '获取密钥',
    subtitle: '在控制台创建 API 令牌',
    icon: <IconKey size='large' />,
  },
  {
    title: '配置工具',
    subtitle: '填写 API 地址和密钥',
    icon: <IconSetting size='large' />,
  },
  {
    title: '开始使用',
    subtitle: '验证成功后即可接入',
    icon: <IconPlay size='large' />,
  },
];

const toolDefinitions = (host, openAiBaseUrl) => [
  {
    key: 'cli',
    tab: (
      <span>
        <IconTerminal style={{ marginRight: 4 }} />
        终端 (CLI)
      </span>
    ),
    title: 'Claude Code (CLI)',
    tags: ['官方工具'],
    summary:
      '通过环境变量 ANTHROPIC_BASE_URL 和 ANTHROPIC_AUTH_TOKEN 直接接入，适合命令行和本地开发环境。',
    sections: [
      {
        title: 'macOS / Linux',
        codeType: 'bash',
        code: `export ANTHROPIC_BASE_URL="${host}"
export ANTHROPIC_AUTH_TOKEN="your-api-key"
claude`,
      },
      {
        title: 'Windows (PowerShell)',
        codeType: 'powershell',
        code: `$env:ANTHROPIC_BASE_URL="${host}"
$env:ANTHROPIC_AUTH_TOKEN="your-api-key"
claude`,
      },
    ],
    tip: '如需永久生效，可将环境变量写入 ~/.zshrc、~/.bashrc 或 PowerShell 用户环境变量。',
  },
  {
    key: 'vscode',
    tab: (
      <span>
        <IconCode style={{ marginRight: 4 }} />
        VS Code
      </span>
    ),
    title: 'VS Code',
    tags: ['Claude Code', '扩展'],
    summary:
      '适用于安装 Claude Code 官方扩展的 VS Code，主要通过 settings.json 注入环境变量。',
    sections: [
      {
        title: 'settings.json',
        codeType: 'json',
        code: `{
  "claude-code.environmentVariables": [
    {
      "name": "ANTHROPIC_BASE_URL",
      "value": "${host}"
    }
  ]
}`,
      },
      {
        title: '密钥写入',
        codeType: 'bash',
        code: `mkdir -p ~/.claude
echo '{"primaryApiKey": "your-api-key"}' > ~/.claude/config.json`,
      },
    ],
    tip: '重启 VS Code 后，在侧边栏打开 Claude Code 即可使用。',
  },
  {
    key: 'cursor',
    tab: 'Cursor',
    title: 'Cursor',
    tags: ['Claude Code', 'AI IDE'],
    summary:
      'Cursor 最稳妥的接法是给内置终端注入环境变量，再在终端里直接启动 claude。',
    sections: [
      {
        title: '.vscode/settings.json',
        codeType: 'json',
        code: `{
  "terminal.integrated.env.osx": {
    "ANTHROPIC_BASE_URL": "${host}",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key"
  },
  "terminal.integrated.env.linux": {
    "ANTHROPIC_BASE_URL": "${host}",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key"
  },
  "terminal.integrated.env.windows": {
    "ANTHROPIC_BASE_URL": "${host}",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key"
  }
}`,
      },
    ],
    tip: '配置完成后，在 Cursor 内置终端执行 `claude` 即可。',
  },
  {
    key: 'cline',
    tab: 'Cline',
    title: 'Cline',
    tags: ['OpenAI Compatible'],
    summary:
      'Cline 走 OpenAI 兼容接口，直接填 Base URL、API Key 和模型名即可。',
    sections: [
      {
        title: '连接配置',
        codeType: 'text',
        code: `API Provider: OpenAI Compatible
Base URL: ${openAiBaseUrl}
API Key: your-api-key
Model ID: claude-opus-4-6`,
      },
    ],
    tip: '验证成功后即可使用文件编辑、终端执行和浏览器操作等能力。',
  },
  {
    key: 'api-direct',
    tab: (
      <span>
        <IconLink style={{ marginRight: 4 }} />
        API 调用
      </span>
    ),
    title: 'API 直接调用',
    tags: ['OpenAI Compatible', 'REST API'],
    summary:
      '适合开发者直接接入自有应用，使用 OpenAI 官方 SDK 或 curl 即可。',
    sections: [
      {
        title: 'curl',
        codeType: 'bash',
        code: `curl ${openAiBaseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-api-key" \\
  -d '{
    "model": "claude-opus-4-6",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`,
      },
      {
        title: 'Python',
        codeType: 'python',
        code: `from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="${openAiBaseUrl}"
)

response = client.chat.completions.create(
    model="claude-opus-4-6",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`,
      },
      {
        title: 'Node.js',
        codeType: 'javascript',
        code: `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'your-api-key',
  baseURL: '${openAiBaseUrl}',
});

const response = await client.chat.completions.create({
  model: 'claude-opus-4-6',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);`,
      },
    ],
    tip: 'OpenAI 兼容工具通常需要填写带 `/v1` 的地址；Claude Code 系列通常直接使用站点根地址。',
  },
];

const GuidePage = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const host = statusState?.status?.server_address || window.location.origin;
  const normalizedHost = host.replace(/\/$/, '');
  const openAiBaseUrl = `${normalizedHost}/v1`;
  const isDark = actualTheme === 'dark';
  const tools = useMemo(
    () => toolDefinitions(normalizedHost, openAiBaseUrl),
    [normalizedHost, openAiBaseUrl],
  );

  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '80px 16px 60px',
        color: 'var(--semi-color-text-0)',
      }}
    >
      <Title
        heading={3}
        style={{ marginBottom: 8, textAlign: 'left', color: 'var(--semi-color-text-0)' }}
      >
        {t('接入教程')}
      </Title>
      <Paragraph
        type='tertiary'
        style={{ marginBottom: 16, textAlign: 'left', color: 'var(--semi-color-text-1)' }}
      >
        了解如何在不同工具中接入本站 API。请先在控制台创建令牌，然后按以下教程配置。
      </Paragraph>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {stepCards.map((step, index) => (
          <Card
            key={step.title}
            bodyStyle={{ padding: 16, textAlign: 'center' }}
            style={{
              borderRadius: 12,
              border: isDark
                ? '1px solid rgba(255,255,255,0.10)'
                : '1px solid var(--semi-color-primary-light-active)',
              background: isDark
                ? 'linear-gradient(180deg, #162131 0%, #111a27 100%)'
                : 'var(--semi-color-primary-light-default)',
            }}
          >
            <div style={{ color: 'var(--semi-color-primary)', marginBottom: 8 }}>
              {step.icon}
            </div>
            <Text type='tertiary' size='small'>
              Step {index + 1}
            </Text>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--semi-color-primary)',
                margin: '4px 0 6px',
              }}
            >
              {step.title}
            </div>
            <Text type='tertiary' size='small'>
              {step.subtitle}
            </Text>
          </Card>
        ))}
      </div>

      <Card
        style={{
          marginBottom: 24,
          borderRadius: 12,
          border: isDark ? '1px solid rgba(255,255,255,0.10)' : undefined,
          background: isDark ? '#111a27' : 'var(--semi-color-bg-0)',
        }}
        bodyStyle={{ textAlign: 'left' }}
      >
        <Collapse defaultActiveKey={['prepare']}>
          <Panel header='准备工作' itemKey='prepare'>
            <Space
              vertical
              spacing='loose'
              align='start'
              style={{ width: '100%', textAlign: 'left', alignItems: 'flex-start' }}
            >
              <Paragraph
                style={{ marginBottom: 0, textAlign: 'left', color: 'var(--semi-color-text-0)' }}
              >
                1. 注册账号并登录控制台。
              </Paragraph>
              <Paragraph
                style={{ marginBottom: 0, textAlign: 'left', color: 'var(--semi-color-text-0)' }}
              >
                2. 在令牌页面创建 API Key。
              </Paragraph>
              <Paragraph
                style={{ marginBottom: 0, textAlign: 'left', color: 'var(--semi-color-text-0)' }}
              >
                3. 牢记两类地址区别：
                Claude Code 系列用 <code>{normalizedHost}</code>，
                OpenAI 兼容工具通常用 <code>{openAiBaseUrl}</code>。
              </Paragraph>
            </Space>
          </Panel>
        </Collapse>
      </Card>

      <Tabs type='line' defaultActiveKey='api-direct'>
        {tools.map((tool) => (
          <Tabs.TabPane tab={tool.tab} itemKey={tool.key} key={tool.key}>
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: 20, textAlign: 'left' }}>
                <Space wrap>
                  <Title
                    heading={5}
                    style={{ margin: 0, textAlign: 'left', color: 'var(--semi-color-text-0)' }}
                  >
                    {tool.title}
                  </Title>
                  {tool.tags.map((tag) => (
                    <Tag key={tag} color='light-blue'>
                      {tag}
                    </Tag>
                  ))}
                </Space>
                <Paragraph
                  type='tertiary'
                  style={{ marginTop: 8, textAlign: 'left', color: 'var(--semi-color-text-1)' }}
                >
                  {tool.summary}
                </Paragraph>
              </div>

              <Space
                vertical
                spacing='loose'
                align='start'
                style={{ width: '100%', alignItems: 'stretch' }}
              >
                {tool.sections.map((section, index) => (
                  <Card
                    key={`${tool.key}-${section.title}`}
                    style={{
                      width: '100%',
                      borderRadius: 12,
                      border: isDark ? '1px solid rgba(255,255,255,0.10)' : undefined,
                      background: isDark ? '#111a27' : 'var(--semi-color-bg-0)',
                    }}
                    bodyStyle={{ textAlign: 'left' }}
                  >
                    <Title
                      heading={6}
                      style={{
                        marginBottom: 8,
                        textAlign: 'left',
                        color: 'var(--semi-color-text-0)',
                      }}
                    >
                      {index + 1}. {section.title}
                    </Title>
                    <pre
                      style={{
                        background: isDark ? '#182131' : 'var(--semi-color-fill-0)',
                        border: isDark
                          ? '1px solid rgba(255,255,255,0.08)'
                          : '1px solid var(--semi-color-border)',
                        borderRadius: 8,
                        padding: '16px',
                        overflow: 'auto',
                        fontSize: 13,
                        lineHeight: 1.6,
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        color: 'var(--semi-color-text-0)',
                        textAlign: 'left',
                      }}
                    >
                      <code>{section.code}</code>
                    </pre>
                  </Card>
                ))}
              </Space>

              <Banner
                type='info'
                fullMode={false}
                closeIcon={null}
                style={{ marginTop: 16, borderRadius: 8 }}
                description={tool.tip}
              />
            </div>
          </Tabs.TabPane>
        ))}
      </Tabs>

      <div style={{ marginTop: 32, textAlign: 'left' }}>
        <Title
          heading={4}
          style={{ marginBottom: 16, textAlign: 'left', color: 'var(--semi-color-text-0)' }}
        >
          常见问题
        </Title>
        <Space
          vertical
          align='start'
          style={{ width: '100%', textAlign: 'left', alignItems: 'stretch' }}
        >
          <Card
            style={{
              borderRadius: 8,
              border: isDark ? '1px solid rgba(255,255,255,0.10)' : undefined,
              background: isDark ? '#111a27' : 'var(--semi-color-bg-0)',
            }}
            bodyStyle={{ textAlign: 'left' }}
          >
            <Title
              heading={6}
              style={{ marginBottom: 8, textAlign: 'left', color: 'var(--semi-color-text-0)' }}
            >
              Q: API 地址应该填什么？需要加 /v1 吗？
            </Title>
            <Paragraph
              type='tertiary'
              style={{ marginBottom: 0, textAlign: 'left', color: 'var(--semi-color-text-1)' }}
            >
              Claude Code、VS Code、Cursor 这类 Claude Code 体系，通常直接使用
              <code>{normalizedHost}</code>。OpenAI SDK、Cline、ChatBox 这类
              OpenAI 兼容工具，通常使用 <code>{openAiBaseUrl}</code>。
            </Paragraph>
          </Card>
          <Card
            style={{
              borderRadius: 8,
              border: isDark ? '1px solid rgba(255,255,255,0.10)' : undefined,
              background: isDark ? '#111a27' : 'var(--semi-color-bg-0)',
            }}
            bodyStyle={{ textAlign: 'left' }}
          >
            <Title
              heading={6}
              style={{ marginBottom: 8, textAlign: 'left', color: 'var(--semi-color-text-0)' }}
            >
              Q: 其他没列出的工具怎么接？
            </Title>
            <Paragraph
              type='tertiary'
              style={{ marginBottom: 0, textAlign: 'left', color: 'var(--semi-color-text-1)' }}
            >
              只要工具支持自定义 OpenAI Base URL 或 Claude 接口地址，基本都能接。核心就是选对协议，然后填正确的地址和 API Key。
            </Paragraph>
          </Card>
          <Card
            style={{
              borderRadius: 8,
              border: isDark ? '1px solid rgba(255,255,255,0.10)' : undefined,
              background: isDark ? '#111a27' : 'var(--semi-color-bg-0)',
            }}
            bodyStyle={{ textAlign: 'left' }}
          >
            <Title
              heading={6}
              style={{ marginBottom: 8, textAlign: 'left', color: 'var(--semi-color-text-0)' }}
            >
              Q: 密钥泄露了怎么办？
            </Title>
            <Paragraph
              type='tertiary'
              style={{ marginBottom: 0, textAlign: 'left', color: 'var(--semi-color-text-1)' }}
            >
              立即登录控制台禁用旧令牌并重新创建新令牌，不要把密钥明文提交到代码仓库。
            </Paragraph>
          </Card>
        </Space>
      </div>
    </div>
  );
};

export default GuidePage;
