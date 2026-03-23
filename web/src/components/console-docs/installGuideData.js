const codeBlock = (strings, ...values) =>
  String.raw({ raw: strings }, ...values).trim();

const INSTALL_GUIDE_ASSETS = {
  fingerImage: '/console-docs/install/finger-up.svg',
  supportQrCode: '/console-docs/install/support-wechat-qr.jpg',
  claudeWindowsStartMenu: '/console-docs/install/claude-windows-start-menu.png',
  claudeWindowsSystemProperties:
    '/console-docs/install/claude-windows-system-properties.jpg',
  claudeWindowsEnvSettings:
    '/console-docs/install/claude-windows-env-settings.jpg',
  claudeWindowsFaqEnv1: '/console-docs/install/claude-windows-faq-env-1.png',
  claudeWindowsFaqEnv2: '/console-docs/install/claude-windows-faq-env-2.png',
};

const SUPPORT_CONTACT = {
  fingerImage: INSTALL_GUIDE_ASSETS.fingerImage,
  buttonText: '有疑问? 技术支持',
  title: '扫码添加客服微信',
  description: '微信扫一扫，添加客服获取帮助',
  qrCodeImage: INSTALL_GUIDE_ASSETS.supportQrCode,
  qrCodeAlt: '客服微信二维码',
};

const CLAUDE_START_CODE = codeBlock`
# 导航到您的项目
$ cd your-project-folder

# 启动 Claude Code
$ claude
`;

const CODEX_START_CODE = codeBlock`
# 导航到您的项目
$ cd your-project-folder

# 启动 Codex
$ codex
`;

const CODEX_AUTH_JSON = codeBlock`
{
  "OPENAI_API_KEY": "你的API_KEY"
}
`;

const CODEX_CONFIG_TOML = codeBlock`
model_provider = "aicodemirror"
model = "gpt-5.4"
model_reasoning_effort = "xhigh"
disable_response_storage = true
preferred_auth_method = "apikey"

[model_providers.aicodemirror]
name = "aicodemirror"
base_url = "https://api.aicodemirror.com/api/codex/backend-api/codex"
wire_api = "responses"
`;

export const CLAUDE_CODE_INSTALL_GUIDE = {
  productId: 'claude-code',
  productLabel: 'Claude Code',
  basePath: '/console/install/claude-code',
  platforms: [
    {
      id: 'macos-linux',
      label: 'macOS/Linux',
      title: 'macOS/Linux ClaudeCode安装指南',
      description: '在 macOS 或 Linux 系统上安装官方 Claude Code CLI',
      sections: [
        {
          id: 'official-package',
          type: 'callout',
          tone: 'success',
          title: '官方原版安装',
          blocks: [
            {
              type: 'paragraph',
              text: '此流程100%使用官方原版安装包，确保服务体验与官方完全一致',
            },
          ],
        },
        {
          id: 'requirements',
          type: 'section',
          title: '系统要求',
          blocks: [
            {
              type: 'paragraph',
              text: 'macOS 10.15+ 系统 或 Linux 系统',
            },
          ],
        },
        {
          id: 'steps',
          type: 'steps',
          title: '安装步骤',
          supportContact: SUPPORT_CONTACT,
          steps: [
            {
              title: '打开终端',
              blocks: [
                {
                  type: 'paragraph',
                  text: '使用 Cmd+Space 搜索 "Terminal" 或在 应用程序 > 实用工具 中找到终端',
                },
              ],
            },
            {
              title: '复制并执行环境检查脚本',
              blocks: [
                {
                  type: 'code',
                  code: '$ curl -fsSL https://download.aicodemirror.com/env_deploy/env-install.sh | bash',
                },
              ],
            },
            {
              title: '卸载已安装的Claude Code（未安装请跳过）',
              blocks: [
                {
                  type: 'code',
                  code: '$ npm uninstall -g @anthropic-ai/claude-code',
                },
              ],
            },
            {
              title: '安装官方原版包',
              blocks: [
                {
                  type: 'code',
                  code: '$ npm install -g @anthropic-ai/claude-code',
                },
              ],
            },
            {
              title: '在「API密钥」界面配置一个API Key',
              blocks: [
                {
                  type: 'paragraph',
                  text: '访问仪表板的「API密钥」页面，创建并复制一个新的API密钥',
                },
              ],
            },
            {
              title: '复制并执行环境变量配置脚本',
              blocks: [
                {
                  type: 'code',
                  code: '$ curl -fsSL https://download.aicodemirror.com/env_deploy/env-deploy.sh | bash -s -- "你的API_KEY"',
                },
              ],
            },
            {
              title: '重启终端，验证安装结果',
              blocks: [
                {
                  type: 'paragraph',
                  text: '重启终端后运行以下命令，确认安装成功',
                },
                {
                  type: 'code',
                  code: '$ claude -v',
                },
              ],
            },
          ],
        },
        {
          id: 'start-using',
          type: 'section',
          title: '开始使用',
          blocks: [
            {
              type: 'paragraph',
              text: '安装完成后，您可以在任何项目目录中开始使用 Claude Code：',
            },
            {
              type: 'code',
              code: CLAUDE_START_CODE,
            },
          ],
        },
      ],
    },
    {
      id: 'windows',
      label: 'Windows',
      title: 'Windows ClaudeCode安装指南',
      description: '在 Windows 系统上安装官方 Claude Code CLI',
      sections: [
        {
          id: 'official-package',
          type: 'callout',
          tone: 'success',
          title: '官方原版安装',
          blocks: [
            {
              type: 'paragraph',
              text: '此流程100%使用官方原版安装包，确保服务体验与官方完全一致',
            },
          ],
        },
        {
          id: 'requirements',
          type: 'section',
          title: '系统要求',
          blocks: [
            {
              type: 'paragraph',
              text: 'Windows 10 (版本 1809 / build 17763) 及以上',
            },
          ],
        },
        {
          id: 'windows-env',
          type: 'accordion',
          title: '预备知识：修改环境变量',
          defaultOpen: true,
          items: [
            {
              title: '在Windows菜单搜索「编辑系统环境变量」',
              image: {
                src: INSTALL_GUIDE_ASSETS.claudeWindowsStartMenu,
                alt: 'Windows开始菜单搜索环境变量',
              },
            },
            {
              title: '弹出系统属性窗口，选择「环境变量」',
              image: {
                src: INSTALL_GUIDE_ASSETS.claudeWindowsSystemProperties,
                alt: '系统属性窗口',
              },
            },
            {
              title:
                '确保只使用「系统变量」。每次新建变量之前，先完整检查用户变量和系统变量中是否已经有这个变量名了，若有请先删除，然后再新建',
              image: {
                src: INSTALL_GUIDE_ASSETS.claudeWindowsEnvSettings,
                alt: '环境变量设置窗口',
              },
            },
            {
              title: '新建环境变量后，需要重启终端才会生效。如果重启终端还不生效，重启电脑',
            },
          ],
          footer:
            '此流程适用于下面所有提到「设置Windows系统环境变量」的场景',
        },
        {
          id: 'steps',
          type: 'steps',
          title: '安装步骤',
          supportContact: SUPPORT_CONTACT,
          steps: [
            {
              title: '【此步骤在桌面】下载git',
              blocks: [
                {
                  type: 'richText',
                  segments: [
                    { type: 'text', text: '访问 ' },
                    {
                      type: 'link',
                      text: 'https://git-scm.com/downloads/win',
                      href: 'https://git-scm.com/downloads/win',
                    },
                    { type: 'text', text: '，安装时全都下一步，不要修改路径' },
                  ],
                },
              ],
            },
            {
              title: '【此步骤在桌面】下载nodejs',
              blocks: [
                {
                  type: 'richText',
                  segments: [
                    { type: 'text', text: '访问 ' },
                    {
                      type: 'link',
                      text: 'https://nodejs.org/zh-cn/download',
                      href: 'https://nodejs.org/zh-cn/download',
                    },
                    { type: 'text', text: '，安装时全都下一步，不要修改路径' },
                  ],
                },
              ],
            },
            {
              title: '【此步骤在Windows PowerShell】验证安装情况',
              blocks: [
                {
                  type: 'paragraph',
                  text: '打开Windows PowerShell（蓝色图标），执行以下命令验证安装情况：',
                },
                {
                  type: 'code',
                  code: 'PS> node -v\nPS> npm -v',
                },
                {
                  type: 'paragraph',
                  text: '若提示「No suitable shell found」，是git没装好。请将 CLAUDE_CODE_GIT_BASH_PATH=C:\\Program Files\\git\\bin\\bash.exe 设置到系统环境变量中，重启终端再试。依旧无效，重装git，重启终端后再试',
                },
              ],
            },
            {
              title: '【此步骤在Windows PowerShell】卸载已安装的Claude Code（未安装请跳过）',
              blocks: [
                {
                  type: 'code',
                  code: 'PS> npm uninstall -g @anthropic-ai/claude-code',
                },
              ],
            },
            {
              title: '【此步骤在Windows PowerShell】安装官方原版包',
              blocks: [
                {
                  type: 'code',
                  code: 'PS> npm install -g @anthropic-ai/claude-code',
                },
              ],
            },
            {
              title: '【此步骤在控制面板】设置Windows系统环境变量',
              blocks: [
                {
                  type: 'paragraph',
                  text: '需要设置以下三个环境变量：',
                },
                {
                  type: 'variables',
                  items: [
                    {
                      name: 'ANTHROPIC_BASE_URL',
                      value: 'https://api.aicodemirror.com/api/claudecode',
                    },
                    {
                      name: 'ANTHROPIC_API_KEY',
                      value: '你的密钥',
                    },
                    {
                      name: 'ANTHROPIC_AUTH_TOKEN',
                      value: '你的密钥',
                    },
                  ],
                },
                {
                  type: 'paragraph',
                  text: '设置方法见上文「预备知识：修改环境变量」',
                },
              ],
            },
            {
              title: '【此步骤在Windows PowerShell】重启Windows PowerShell，验证安装结果',
              blocks: [
                {
                  type: 'paragraph',
                  text: '重启Windows PowerShell后运行以下命令，确认安装成功',
                },
                {
                  type: 'code',
                  code: 'PS> claude -v',
                },
              ],
            },
          ],
        },
        {
          id: 'start-using',
          type: 'section',
          title: '开始使用',
          blocks: [
            {
              type: 'paragraph',
              text: '安装完成后，您可以在任何项目目录中开始使用 Claude Code：',
            },
            {
              type: 'code',
              code: CLAUDE_START_CODE,
            },
          ],
        },
        {
          id: 'faq',
          type: 'faq',
          title: '常见问题',
          issues: [
            {
              title: '问题1: Unable to connect to Anthropic services',
              image: {
                src: INSTALL_GUIDE_ASSETS.claudeWindowsFaqEnv1,
                alt: '环境变量配置错误示例',
              },
            },
            {
              title: '问题2: 401 Invalid token',
              image: {
                src: INSTALL_GUIDE_ASSETS.claudeWindowsFaqEnv2,
                alt: '环境变量配置错误示例',
              },
            },
          ],
          groups: [
            {
              lead: 'Win原生用户若配置完环境变量但不生效，请尝试以下步骤：',
              items: [
                '备份「C:\\users\\你的用户\\.claude.json」文件',
                '删除「C:\\users\\你的用户\\.claude.json」文件',
                '重新打开claude code，并在弹出的交互页「yes/no(recommended)」选项里选yes',
              ],
            },
            {
              lead: '若上述步骤执行完后依旧存在问题1，则执行下面步骤：',
              items: [
                '修改「C:\\users\\你的用户\\.claude.json」文件，在最外层json中增加「"hasCompletedOnboarding": true」',
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const CODEX_INSTALL_GUIDE = {
  productId: 'codex',
  productLabel: 'Codex',
  basePath: '/console/install/codex',
  platforms: [
    {
      id: 'macos-linux',
      label: 'macOS/Linux',
      title: 'macOS/Linux Codex安装指南',
      description: '在 macOS 或 Linux 系统上安装官方 Codex CLI',
      sections: [
        {
          id: 'official-package',
          type: 'callout',
          tone: 'success',
          title: '官方原版安装',
          blocks: [
            {
              type: 'paragraph',
              text: '此流程100%使用官方原版安装包，确保服务体验与官方完全一致',
            },
          ],
        },
        {
          id: 'requirements',
          type: 'section',
          title: '系统要求',
          blocks: [
            {
              type: 'paragraph',
              text: 'macOS 10.15+ 系统 或 Linux 系统',
            },
          ],
        },
        {
          id: 'steps',
          type: 'steps',
          title: '安装步骤',
          supportContact: SUPPORT_CONTACT,
          steps: [
            {
              title: '安装 Codex 官方原版包',
              blocks: [
                {
                  type: 'code',
                  code: '$ npm install -g @openai/codex\n# 或者\n$ brew install codex',
                },
              ],
            },
            {
              title: '创建目录',
              blocks: [
                {
                  type: 'code',
                  code: '$ rm -rf ~/.codex\n$ mkdir ~/.codex',
                },
              ],
            },
            {
              title: '在「API密钥」界面配置一个API KEY',
              blocks: [
                {
                  type: 'paragraph',
                  text: '访问仪表板的「API密钥」页面，创建并复制一个新的API密钥',
                },
              ],
            },
            {
              title: '创建auth.json文件',
              blocks: [
                {
                  type: 'paragraph',
                  text: '删除~/.codex路径下已存在的auth.json文件(若有)，然后新建一个auth.json，内容为：',
                },
                {
                  type: 'code',
                  code: CODEX_AUTH_JSON,
                },
              ],
            },
            {
              title: '创建config.toml文件',
              blocks: [
                {
                  type: 'paragraph',
                  text: '删除~/.codex路径下已存在的config.toml文件(若有)，然后新建一个config.toml，内容直接原封不动的粘贴下文：',
                },
                {
                  type: 'code',
                  code: CODEX_CONFIG_TOML,
                },
              ],
            },
            {
              title: '重启终端，验证安装结果',
              blocks: [
                {
                  type: 'paragraph',
                  text: '重启终端后运行以下命令，确认安装成功',
                },
                {
                  type: 'code',
                  code: '$ codex -V',
                },
              ],
            },
          ],
        },
        {
          id: 'start-using',
          type: 'section',
          title: '开始使用',
          blocks: [
            {
              type: 'paragraph',
              text: '安装完成后，您可以在任何项目目录中开始使用 Codex：',
            },
            {
              type: 'code',
              code: CODEX_START_CODE,
            },
          ],
        },
        {
          id: 'vscode-plugin',
          type: 'section',
          title: '支持VSCode官方插件',
          blocks: [
            {
              type: 'paragraph',
              text: '完全支持VSCode官方插件',
            },
          ],
        },
      ],
    },
    {
      id: 'windows',
      label: 'Windows',
      title: 'Windows Codex安装指南',
      description: '在 Windows 系统上安装官方 Codex CLI',
      sections: [
        {
          id: 'official-package',
          type: 'callout',
          tone: 'success',
          title: '官方原版安装',
          blocks: [
            {
              type: 'paragraph',
              text: '此流程100%使用官方原版安装包，确保服务体验与官方完全一致',
            },
          ],
        },
        {
          id: 'requirements',
          type: 'section',
          title: '系统要求',
          blocks: [
            {
              type: 'paragraph',
              text: 'Windows 10 (版本 1809 / build 17763) 及以上',
            },
          ],
        },
        {
          id: 'steps',
          type: 'steps',
          title: '安装步骤',
          supportContact: SUPPORT_CONTACT,
          steps: [
            {
              title: '安装 Codex 官方原版包',
              blocks: [
                {
                  type: 'code',
                  code: '$ npm install -g @openai/codex\n# 或者\n$ brew install codex',
                },
              ],
            },
            {
              title: '创建目录',
              blocks: [
                {
                  type: 'paragraph',
                  text: '先删除 C:\\users\\你的用户\\.codex（若有），然后再重新创建 C:\\users\\你的用户\\.codex',
                },
              ],
            },
            {
              title: '在「API密钥」界面配置一个API KEY',
              blocks: [
                {
                  type: 'paragraph',
                  text: '访问仪表板的「API密钥」页面，创建并复制一个新的API密钥',
                },
              ],
            },
            {
              title: '创建auth.json文件',
              blocks: [
                {
                  type: 'paragraph',
                  text: '删除C:\\users\\你的用户\\.codex路径下已存在的auth.json文件(若有)，然后新建一个auth.json，内容为：',
                },
                {
                  type: 'code',
                  code: CODEX_AUTH_JSON,
                },
              ],
            },
            {
              title: '创建config.toml文件',
              blocks: [
                {
                  type: 'paragraph',
                  text: '删除C:\\users\\你的用户\\.codex路径下已存在的config.toml文件(若有)，然后新建一个config.toml，内容直接原封不动的粘贴下文：',
                },
                {
                  type: 'code',
                  code: CODEX_CONFIG_TOML,
                },
              ],
            },
            {
              title: '重启终端，验证安装结果',
              blocks: [
                {
                  type: 'paragraph',
                  text: '重启终端后运行以下命令，确认安装成功',
                },
                {
                  type: 'code',
                  code: '$ codex -V',
                },
              ],
            },
          ],
        },
        {
          id: 'start-using',
          type: 'section',
          title: '开始使用',
          blocks: [
            {
              type: 'paragraph',
              text: '安装完成后，您可以在任何项目目录中开始使用 Codex：',
            },
            {
              type: 'code',
              code: CODEX_START_CODE,
            },
          ],
        },
        {
          id: 'vscode-plugin',
          type: 'section',
          title: '支持VSCode官方插件',
          blocks: [
            {
              type: 'paragraph',
              text: '完全支持VSCode官方插件',
            },
          ],
        },
      ],
    },
  ],
};

export const INSTALL_GUIDES = {
  'claude-code': CLAUDE_CODE_INSTALL_GUIDE,
  codex: CODEX_INSTALL_GUIDE,
};
