import React from 'react';
import { IconFeishuLogo, IconGit, IconFigma, IconTemplateStroked, 
    IconSearch, IconConnectionPoint2, IconFile, IconFolder, 
    IconBranch, IconTerminal, IconGlobeStroke, IconCode
} from '@douyinfe/semi-icons';

export const modelOptions = [
    {
        value: 'GPT-5',
        label: 'GPT-5',
        type: 'gpt',
    },
    {
        value: 'GPT-4o',
        label: 'GPT-4o',
        type: 'gpt',
    },
    {
        value: 'Claude 3.5 Sonnet',
        label: 'Claude 3.5 Sonnet',
        type: 'claude',
    },
];

export const mcpOptions = [
    {
        icon: <IconFeishuLogo />,
        label: "飞书文档",
        value: "feishu",
    },
    {
        icon: <IconGit />,
        label: "Github Mcp",
        value: "github",
    },
    {
        icon: <IconFigma />,
        label: "IconFigma Mcp",
        value: "IconFigma",
    }
];

export const radioButtonProps = [
    {
        label: <IconTemplateStroked />,
        value: 'template',
    },
    {
        label: <IconSearch />,
        value: 'search',
    }
];

export const radioButtonProps1 = [
    {
        label: '极速',
        value: 'fast',
    },
    { 
        label: '思考',
        value: 'think',
    },
    {
        label: '超能',
        value: 'super',
    }
];

export const radioButtonProps2 = [
    {
        label: <IconTemplateStroked />,
        value: 'fast',
    },
    { 
        label: <IconSearch />,
        value: 'think',
    }
];

export const uploadProps = {
    action: "https://api.semi.design/upload"
};

export const reference = [
    {
        id: '1',
        type: 'text',
        content: '测试文本，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字,这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字，这里是一段很长的文字',
    },
    {
        id: '2',
        name: '飞书文档.docx',
    },
    {
        id: '3',
        name: '飞书文档.pdf',
    },
    {
        id: '4',
        name: 'Music.mp3',
    },
    {
        id: '5',
        name: 'Music.mp4',
    },
    {
        id: '6',
        name: 'Image.jpeg',
        url: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/Resso.png'
    },
    {
        id: '7',
        name: 'code.json',
    }
];

export const refTypeToIconMap = new Map([
    ['file', <IconFile key={'file'} size="small" />],
    ['folder', <IconFolder key={'folder'} size="small" />],
    ['branch', <IconBranch key={'branch'} size="small" />],
    ['terminal', <IconTerminal key={'terminal'} size="small" /> ],
    ['web', <IconGlobeStroke key={'globalStroke'} size="small" />],
    ['change', <IconConnectionPoint2 key={'connectionPoint2'} size="small" />],
    ['git', <IconGit key="git" size="small" />],
    ['code', <IconCode key="code" size="small" />],

]);

export const customReferences = [
    {
        type: 'file',
        key: '1',
        name: 'horizontalScroller.tsx',
        path: 'packages/semi-ui/AIChatInput/horizontalScroller.tsx',
    },
    {
        type: 'folder',
        key: '2',
        name: 'AIChatInput',
        path: 'packages/semi-ui/AIChatInput',
    },
    {
        type: 'web',
        key: '3',
        name: 'web'
    },
    {
        type: 'change',
        key: '4',
        name: 'recentChange'
    },
    {
        type: 'branch',
        key: '5',
        name: 'Branch',
        detail: 'Diff with Main Branch',
        branch: 'feat/aichatinput',
        targetBranch: 'feat/targetBranch',
    },
    {
        type: 'terminal',
        key: '6',
        name: 'From 1-2',
        from: 1,
        to: 2,
    }
];

export const skills = [
    {
        icon: <IconTemplateStroked />,
        value: 'writing',
        label: '帮我写作',
        hasTemplate: true,
    },
    {
        icon: <IconSearch />,
        value: 'AI 编程',
        label: 'AI coding'
    },
    {
        icon: <IconTemplateStroked />,
        value: 'writing1',
        label: '帮我写作1'
    },
    {
        icon: <IconSearch />,
        value: 'AI 编程1',
        label: 'AI coding1'
    },
    {
        icon: <IconTemplateStroked />,
        value: 'writing2',
        label: '帮我写作2'
    },
    {
        icon: <IconSearch />,
        value: 'AI 编程2',
        label: 'AI coding2'
    },
    {
        icon: <IconTemplateStroked />,
        value: 'writing3',
        label: '帮我写作3'
    },
    {
        icon: <IconSearch />,
        value: 'AI 编程3',
        label: 'AI coding3'
    },
    {
        icon: <IconTemplateStroked />,
        value: 'writing4',
        label: '帮我写作4'
    },
    {
        icon: <IconSearch />,
        value: 'AI 编程4',
        label: 'AI coding4'
    },
    {
        icon: <IconTemplateStroked />,
        value: 'writing5',
        label: '帮我写作5'
    },
    {
        icon: <IconSearch />,
        value: 'AI 编程5',
        label: 'AI coding5'
    },
    {
        icon: <IconTemplateStroked />,
        value: 'writing6',
        label: '帮我写作6'
    },
    {
        icon: <IconSearch />,
        value: 'AI 编程7',
        label: 'AI coding7'
    },
    {
        icon: <IconTemplateStroked />,
        value: 'writing8',
        label: '帮我写作8'
    },
    {
        icon: <IconTemplateStroked />,
        value: 'AI 编程8',
        label: 'AI coding8'
    },
];

export const template = [
    {
        groupKey: 'value',
        group: '工作',
        children: [
            {
                bg: 'var(--semi-color-primary)',
                icon: <IconTemplateStroked />,
                title: '总结汇报',
                desc: '凝练你的工作成效',
                content: `我的职业是<input-slot placeholder="[请输入职业]"></input-slot>，帮我写一份关于<input-slot placeholder="[输入目的：项目进展总结、团队工作成果或其他]</input-slot>的总结汇报`
            },
            {
                bg: 'var(--semi-color-warning)',
                icon: <IconTemplateStroked />,
                title: '话术',
                desc: '满足不同场景表达需求',
                content: `我是一名<select-slot value="打工人" options='["打工人", "学生"]'></select-slot> ，帮我写一段面向<input-slot placeholder="[输入对象]">陌生同事</input-slot>的话术内容`
            },
            {
                bg: 'var(--semi-color-success)',
                icon: <IconTemplateStroked />,
                title: '研究报告',
                desc: '深度研究，精准分析',
                content: '我的职业是<input-slot placeholder="[输入职业]">研究员</input-slot> ，帮我写一篇关于<input-slot placeholder="[输入主题]"></input-slot>的研究报告。'
            },
            {
                bg: 'var(--semi-color-primary)',
                icon: <IconTemplateStroked />,
                title: '心得体会',
                desc: '助你提炼归纳所感所悟',
                content: '我的职业是<input-slot placeholder="[输入职业]"></input-slot> ，帮我写一份关于<input-slot placeholder="[输入主题]"></input-slot>的心得体会。'
            },
            {
                bg: 'var(--semi-color-warning)',
                icon: <IconTemplateStroked />,
                title: '思想汇报',
                desc: '进行反思梳理和深入总结',
                content: '我的职业是<input-slot placeholder="[输入职业]"></input-slot>，帮我写一份关于<input-slot placeholder="[输入主题]"></input-slot>的思想汇报。'
            },
            {
                bg: 'var(--semi-color-success)',
                icon: <IconTemplateStroked />,
                title: '方案策划',
                desc: '量身定制各种方案',
                content: '我是一名<input-slot placeholder="[输入职业]"></input-slot>职业策划人 ，帮我写一个<input-slot placeholder="[方案类型：如线下读书会活动方案等]"></input-slot>线下读书会活动 的方案，需要包含但不限于策划目标、详细计划、所需资源和预算、效果评估、风险应对等。'
            }
        ]
    },
    {
        groupKey: 'marketing',
        group: '商业营销',
        children: [
            {
                bg: 'var(--semi-color-primary)',
                icon: <IconTemplateStroked />,
                title: '宣传文案',
                desc: '撰写各平台的推广文案',
                content: '帮我写一篇面向<input-slot placeholder="[输入目标人群]"></input-slot>职场人，关于<input-slot placeholder="[输入产品]"></input-slot>的宣传文案，需要直击痛点，吸引用户点击。'
            },
            {
                bg: 'var(--semi-color-warning)',
                icon: <IconTemplateStroked />,
                title: '方案策划',
                desc: '量身定制各种方案',
                content: '我是一名<input-slot placeholder="[输入职业]"></input-slot>职业策划人，帮我写一个<input-slot placeholder="[方案类型：如线下读书会活动方案等]"></input-slot>线下读书会活动 的方案，需要包含但不限于策划目标、详细计划、所需资源和预算、效果评估、风险应对等。'
            },
            {
                bg: 'var(--semi-color-success)',
                icon: <IconTemplateStroked />,
                title: '市场调研报告',
                desc: '精准分析市场洞察',
                content: '我是一名<input-slot placeholder="[输入职业]"></input-slot>营销专家，帮我写一个关于<input-slot placeholder="[输入主题]"></input-slot>的市场调研报告，需要包含调研背景、调研目标、调研方法、市场分析、总结建议等，以总分总结构呈现。'
            },
            {
                bg: 'var(--semi-color-success)',
                icon: <IconTemplateStroked />,
                title: '广告创意文案',
                desc: '创作吸引眼球的广告词',
                content: '帮我给<input-slot placeholder="[输入产品]"></input-slot>写 10 个广告创意文案，文案风格为年轻人喜欢的幽默的 ，要求每个广告创意文案的字数控制在<input-slot placeholder="[输入数字]">50</input-slot>左右，每个创意文案不重复，有明显的差异。'
            },
            {
                bg: 'var(--semi-color-primary)',
                icon: <IconTemplateStroked />,
                title: '推广策略',
                desc: '制定高效的营销推广方案',
                content: '帮我给<input-slot placeholder="[输入产品]"></input-slot>写一篇推广策略，需要包含目标受众分析、推广渠道、传播策略、制定预算、效果评估方案等。'
            },
            {
                bg: 'var(--semi-color-warning)',
                icon: <IconTemplateStroked />,
                title: '大纲',
                desc: '创建清晰的写作结构',
                content: '帮我生成一个关于<input-slot placeholder="[输入主题]"></input-slot>的大纲，用于<input-slot placeholder="[使用场景]">PowerPoint 制作</input-slot> 。'
            }
        ]
    }
];

export const suggestionTemplate = [ '天气如何', '空气质量', '工作进程', '日程安排'];
