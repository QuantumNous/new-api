const TUTORIAL_PAGE_ASSETS = {
  wechatClaudeCodeBestPractices:
    '/console-docs/tutorial/wechat/claude-code-best-practices.jpg',
  wechatClaudeCodeRpa: '/console-docs/tutorial/wechat/claude-code-rpa.jpg',
  wechatVscodeClaude45: '/console-docs/tutorial/wechat/vscode-claude-45.jpg',
  blogClaudeCodeTips: '/console-docs/tutorial/blog/claude-code-tips-blog.png',
  blogClaudeCodeFullGuide:
    '/console-docs/tutorial/blog/claude-code-full-guide.png',
  videoClaudiaGui: '/console-docs/tutorial/video/claudia-gui.jpg',
  videoSuperClaude: '/console-docs/tutorial/video/superclaude.jpg',
  videoStagehand: '/console-docs/tutorial/video/stagehand.jpg',
  videoClaudeCode30Tips:
    '/console-docs/tutorial/video/claude-code-30-tips.jpg',
};

export const TUTORIAL_PAGE = {
  title: '使用教程',
  description:
    '通过精选的教程、文章和视频，快速掌握 Claude Code 共享平台的使用方法',
  groups: [
    {
      id: 'wechat',
      title: '微信公众号',
      items: [
        {
          title: 'Claude Code 最佳实践',
          description:
            '翻译自 anthropic 官网，原文链接 https://www.anthropic.com/enginee',
          href: 'https://mp.weixin.qq.com/s/_xqHmQsLSquA5qoXe8JQWw',
          image: TUTORIAL_PAGE_ASSETS.wechatClaudeCodeBestPractices,
        },
        {
          title: '所有的RPA可以去死了！Claude Code可以只靠口喷完成一切！',
          description:
            '所有的RPA可以去死了！！只需要Claude Code，就能完成一切基于网页的自动化！不需要任何技能和门槛，只需要口喷！',
          href: 'https://mp.weixin.qq.com/s/Ad70QxBtCfLoyZFer0At5Q',
          image: TUTORIAL_PAGE_ASSETS.wechatClaudeCodeRpa,
        },
        {
          title: '在VSCode中轻松使用Claude 4.5 Sonnet',
          description:
            '原本可以正常通过 VSCode 的 Claude Code 插件正常访问，今早更新后发现突然需要登录官方账号了。一招教你解决！',
          href: 'https://mp.weixin.qq.com/s/zDoEp4hyO88-4NQKxOjtJQ',
          image: TUTORIAL_PAGE_ASSETS.wechatVscodeClaude45,
        },
      ],
    },
    {
      id: 'blog',
      title: '博客文章',
      items: [
        {
          title: 'Claude Code 技巧博客',
          description: '隐藏的高级技巧与窍门',
          href: 'https://www.youware.com/project/12j7l4bqao',
          image: TUTORIAL_PAGE_ASSETS.blogClaudeCodeTips,
        },
        {
          title: 'Claude Code完全指南：使用教程详解，看这一篇就够了！',
          description:
            '这篇指南将带你全面了解这款 AI 编码工具，从安装配置到核心功能应用，助你高效修复 bug、轻松管理代码、提升团队协作，加速软件开发，显著提高生产力！',
          href: 'https://blog.axiaoxin.com/post/claude-code-full-guide/',
          image: TUTORIAL_PAGE_ASSETS.blogClaudeCodeFullGuide,
        },
      ],
    },
    {
      id: 'video',
      title: '教学视频',
      items: [
        {
          title:
            '🚀Claudia让你丢掉Cursor告别命令行！Claude Code终于有GUI了！专为Claude Code打造最强可视化界面保姆级教程！可视化项目管理',
          description:
            '🚀Claudia让你丢掉Cursor告别命令行！Claude Code终于有GUI了！专为Claude Code打造最强可视化界面保姆级教程！可视化项目管理、智能体创建、记忆文件配置，AI编程如此简单 🚀🚀🚀视频简介： ✅颠覆性突破！从Cursor转向Claude Code必看！告别复杂命令行，Claudia为Claude Code打造最强可视化界面，轻松管理项目、监控Token、添加MCP服务器，编程效率提升1000% 【保姆级教程】 🚀本期视频为大家详细介绍了专为Claude Code打造的可视化GUI工具——Claudia！ ✨ Claudia核心亮点： • 🎯 告别复杂命令行，提供超友好的可视化界面 • 📊 实时监控Token使用情况和API成本 • 🔧 轻松管理MCP服务器，一键添加Context7等工具 • 💾 创建检查点功能，随时恢复项目状态 • 🤖 支持创建自定义AI智能体 🎮 实战演示包括： • 基于macOS的完整部署教程 • 调用Context7搜索Three.js文档，创建3D汽车驾驶游戏 • 打造"开源项目分析专家"智能体，自动生成详细分析报告 • 配置Claude Code记忆文件，开发符合技术栈的Todo List应用 🔥🔥🔥时间戳： 00:00 - Claudia介绍：Claude Code的可视化GUI工具 00:12 - Claudia核心功能展示：项目管理、Token监控、MCP服务器 00:42 - 检查点功能演示：创建和恢复项目状态 01:15 - Claudia与Claude Code的关系说明 02:10 - macOS平台部署Claudia详细步骤 03:16 - Claudia界面功能介绍：项目管理和Token统计 03:58 - 添加Context7 MCP服务器配置 04:40 - 创建Three.js 3D汽车驾驶游戏项目 06:00 - 游戏效果展示：3D场景、汽车控制 06:16 - 创建AI智能体：开源项目分析专家 07:30 - 项目分析报告生成和结果展示 08:16 - Claude Code记忆文件配置 08:33 - 使用记忆文件开发Todo List应用 09:00 - Todo List应用效果展示和功能测试 10:18 - 总结：Claudia相比命令行的优',
          href: 'https://www.bilibili.com/video/BV16D34zpEGu/?spm_id_from=333.337.search-card.all.click&vd_source=85370b8e78dc18738218ebde1324726d',
          image: TUTORIAL_PAGE_ASSETS.videoClaudiaGui,
        },
        {
          title:
            '🚀 SuperClaude让Claude Code编程能力暴增300%！小白秒变顶尖程序员！19个专业命令+9大预定义角色，零编程经验也能开发复杂项目',
          description:
            '🚀 SuperClaude让Claude Code编程能力暴增300%！小白秒变顶尖程序员！19个专业命令+9大预定义角色，零编程经验也能开发复杂项目，完全碾压Cursor等AI编程工具！颠覆传统编程 🚀🚀🚀视频简介： ✅【保姆级教程】颠覆性突破！SuperClaude开源框架彻底改变Claude Code使用方式，一条命令搞定所有开发需求，从环境配置到安全扫描一站式解决，告别复杂提示词时代！编程小白秒变大神！ 🚀 本期视频详细演示了开源配置框架SuperClaude，这是一款专门为Claude Code开发的强大工具！通过19个结构化命令和9个预定义角色，SuperClaude彻底解决了Claude Code缺乏专业化开发流程的问题。 💡 视频完整展示了SuperClaude的安装部署过程，并通过实际案例演示了核心功能： /analyze命令对开源项目进行专业架构分析 📊 /dev-setup命令快速配置React开发环境 ⚛️ /build命令从零开发Todo List应用，包括用户管理系统 ✅ /scan命令进行项目安全扫描，发现潜在漏洞 🔒 🎯 SuperClaude集成了系统架构师、前端专家、后端专家、安全专家等专业角色，还支持Context Seven、Sequential、Magic、Puppeteer等MCP服务器。 🔥🔥🔥时间戳： 00:00 SuperClaude介绍 - Claude Code配置框架 00:55 SuperClaude功能特性 - 19个命令和9个角色 02:00 /build命令演示 - 创建太阳系动画项目 03:13 SuperClaude安装部署教程 04:24 /analyze命令演示 - 开源项目架构分析 06:00 /dev-setup命令 - React开发环境配置 07:59 /build命令开发Todo List应用 09:25 添加用户管理系统功能 10:33 /scan命令 - 项目安全扫描 11:08 总结SuperClaude优势和获取资源 #claude #superclaude #claudecode #vibecoding #aiprogramming #aicoding #ai #aiagents #cursor #agi #puppeteer #context',
          href: 'https://www.bilibili.com/video/BV1rh3DzWEVF/?spm_id_from=333.1387.homepage.video_card.click&vd_source=85370b8e78dc18738218ebde1324726d',
          image: TUTORIAL_PAGE_ASSETS.videoSuperClaude,
        },
        {
          title:
            '🚀颠覆性创新！Stagehand革命性AI浏览器自动化框架！支持TypeScript+Python+云端部署！比Browser-Use更快更精准！代码精准控制',
          description:
            '🚀颠覆性创新！Stagehand革命性AI浏览器自动化框架！支持TypeScript+Python+云端部署！比Browser-Use更快更精准！代码精准控制+自然语言决策效率提升10倍！保姆级教程！ 🚀🚀🚀视频简介： ✅【保姆级教程】开源神器！Stagehand浏览器自动化实战演示：3分钟完成Browser-Use需要10分钟的复杂任务！效率提升不是梦！ 🚀 本期视频详细演示了全新开源浏览器自动化框架Stagehand的强大功能！相比完全依赖AI决策的Browser-Use，Stagehand采用革命性的代码+自然语言混合驱动模式，实现了速度与精准度的完美平衡！ ✨ 核心亮点包括：支持TypeScript/JavaScript/Python多语言生态，基于Playwright构建的原子化精准控制，act/extract/observe三大核心方法，以及强大的云端浏览器支持！演示中我们用Stagehand自动访问博客、提取文章标题并智能总结内容，整个过程流畅高效，执行速度比传统AI驱动框架提升3倍以上！ 🛠️ 视频包含完整的环境搭建、API配置、代码实现和本地/云端部署演示，让你快速掌握这款开源神器！ 👉👉👉笔记:https://www.aivi.fyi/aiagents/introduce-stagehand 🔥🔥🔥时间戳： 00:00 开场介绍 - Browser-Use框架的局限性分析 00:33 核心优势解析 - Stagehand框架的混合驱动模式 01:14 框架对比评测 - Stagehand vs Browser-Use详细对比 02:14 优势功能展示 - act、extract、observe三大核心方法 03:42 环境安装配置 - PyCharm项目创建和依赖安装 04:33 API配置设置 - OpenAI和Browserbase环境变量配置 05:14 代码演示准备 - Jupyter Notebook项目结构解析 06:18 本地执行演示 - 博客内容自动抓取和分析流程 08:04 执行结果分析 - Token消耗和时间效率详细对比 10:41 云端部署演示 - Browserbase云端浏览器自动化 11:26 总结收尾 - 完整代码获取方式和观看感谢 #stagehand #stagehandlif',
          href: 'https://www.bilibili.com/video/BV1fdtnzkEFB?buvid=XX371AC393E90C49878927F4CBD1E10480B91&from_spmid=search.search-result.0.0&is_story_h5=false&mid=Cd8vrBoWK%2F1qWhkVruFJPg%3D%3D&plat_id=116&share_from=ugc&share_medium=android&share_plat=android&share_session_id=85341643-9c21-4da6-a3d3-fcb1cb3d89ab&share_source=WEIXIN&share_tag=s_i&spmid=united.player-video-detail.0.0&timestamp=1754532768&unique_k=HTwruD9&up_id=3493277319825652',
          image: TUTORIAL_PAGE_ASSETS.videoStagehand,
        },
        {
          title: '最火AI编程Claude Code详细攻略，一期视频精通',
          description:
            '介绍30个Claude Code高阶使用技巧，一期视频精通Claude Code。Claude Code是近期热度最高的AI编程工具，特别在海外社区获得了大量讨论。上期视频我们介绍了国内免费的使用Claude Code方法，还有一些基础入门。本期我们进入实战环节，带来30个Claude Code进阶使用技巧。',
          href: 'https://www.bilibili.com/video/BV1XGbazvEuh/?spm_id_from=333.1007.top_right_bar_window_history.content.click&vd_source=85370b8e78dc18738218ebde1324726d',
          image: TUTORIAL_PAGE_ASSETS.videoClaudeCode30Tips,
        },
      ],
    },
  ],
};
