/**
 * [description] app locale
 */

const appLocale = {
    locale: 'zh-CN',
    messages: {

        "apiDoc": "API 文档",
        "designDoc": "设计文档",

        // designToken
        'designToken.variable': '变量',
        'designToken.defaultValue': '默认值',
        'designToken.usage': '用法',
        'designToken.WIP': '暂无',

        // app
        'app.next': '下一步',

        // footer
        'footer.component': 'React 组件库',
        'footer.dsm': '主题与 DSM',

        //new footer
        "footer.design": "设计系统",
        "footer.getInfo": "获取 Semi 动态",
        "footer.getInfo.lark": "Semi 飞书群",
        "footer.getInfo.redBook": "小红书",
        "footer.friends": "友情链接",



        // search
        'search.belong.component': '组件',
        'search.belong.material': '物料',
        'search.belong.design': '设计规范',
        'search.belong.site': '站点',
        'search.type.paragraph': '段落',
        'search.type.heading': '标题',
        'search.type.code': '代码',
        'search.type.brief': '简要',
        // 'search.type.title':'文档',
        'search.type.strong': '加粗',
        'search.msg.peopleSearch': '大家在搜',
        'search.input.placeholder': '搜索组件/物料/资源',

        // common
        component: '组件',
        themeStore: '主题商店',
        designLanguage: '设计语言',
        designConcept: '为企业级中后台应用，打造高效易用美观的产品体验。',
        language: '语言',
        materialSite: '物料平台',
        changelog: '更新日志',
        'changelog.internal.link': '该类地址为 Semi 未开源时使用地址，外部用户可能无法访问，如有问题可以提 issue~',

        // header
        'header.switchLanguage': 'Switch Language',
        'themePicker.primaryColor': '主色',
        'themePicker.confirm': '确定',

        'editor.copy': '拷贝代码',
        'editor.copy.success': '复制成功',
        'editor.reset': '重置代码',
        'editor.expand': '展开代码',
        'editor.collapse': '收起代码',
        'editor.liveTag': '可实时编辑',

        // changelog diff
        'changelog.diff.button': '版本对比',
        'changelog.diff.title': '版本对比',
        'changelog.diff.version1.insetLabel': '版本 1',
        'changelog.diff.version2.insetLabel': '版本 2',
        'changelog.diff.version.placeholder': '请选择版本',
        'changelog.diff.change.insetLabel': '变更',
        'changelog.diff.change.all': '全部',
        'changelog.diff.empty': '该版本之间无更新',
        'changelog.diff.type.placeholder': '请选择变更类别',
        'changelog.diff.type.insetLabel': '类别',


        // Icon list
        'icon.list.tab.fill': '面性图标',
        'icon.list.tab.stroked': '线性图标',
        'icon.list.tab.ai': 'AI 图标',
        'icon.list.tab.lab': '彩色图标',

        // new  Home
        // page one
        "enterprise_product_design_system": "连接设计师与开发者",
        "home_banner_description": "由抖音前端与 UED 团队维护，易于定制的现代化设计系统，帮助设计师与开发者打造高质量产品。",
        "start_using": "开始使用",
        // page two: products
        "now_serving_100_000": "已服务 10 万 + 用户",
        // page three: feature
        "feature_title": "先进的开发者体验",
        "feature_subtitle": "开箱即用的底层能力支持，为开发者节省精力，避免重造",
        "feature_FA": "易于贡献的 FA 架构",
        "feature_FA_description": "Semi 基于 FA 架构设计，主逻辑抽象为 Foundation 包，源码清晰易读，易于迁移到其他框架",
        "feature_a11y": "A11y 无障碍友好",
        "feature_a11y_description": "Semi 遵循 W3C 标准为所有组件提供键盘交互、焦点管理和语义化支持",
        "feature_language": "国际化与多语言",
        "feature_language_description": "Semi 提供完备的多语言、多时区、RTL 支持，助你轻松打造全球化应用",
        "feature_live_code": "Live Code 组件",
        "feature_live_code_description": "LiveCode 允许你使用在线代码编辑器即时演示你的 UI 组件",
        "feature_test": "稳定的质量保障",
        "feature_test_description": "Semi 稳定迭代 5 年+，使用了单元测试、E2E 测试、视觉对比测试等多种方法保证组件的稳定和质量，测试覆盖率达到 90%",
        "adapter_webComponents": "轻松兼容 web components",
        "adapter_webComponents_description": "提供完整的适配方案，所有的组件在 shadow DOM 中均可正常工作，更适合用于构建 SDK、浏览器插件等需要 DOM 隔离的场景",
        "feature_SSR": "支持 SSR",
        "feature_SSR_description": "Semi 组件库支持 SSR 场景，可以在 Next.js、Gatsby 和 Remix 等框架中使用",
        "feature_D2C": "设计稿转代码",
        "feature_D2C_description": "Semi 提供高效的 design to code 能力，3-5s，一键点击，从 Figma 设计稿生成真实代码",
        // page four: theme
        "home.theme": "百变主题",
        "home.theme.desc": "提供高达 3000+ Design Token，快速克隆或深度定制，灵活调配符合品牌调性的设计风格",
        // page five: DSM
        "semi_dsm": "Semi 设计系统管理",
        "powerful_theme_editor__real_time_effect__one_click_synchronization_of_design_too_d77f5776bf126331e801d6d6aa0146f2": "强大的主题编辑器，实时生效，设计工具一键同步",
        // page six: C to D to C
        "home.pro.title": "让设计与代码同源",
        "home.pro.desc": "使用真实组件设计，前端代码一键转",
        "home.pro.start": "了解更多",
        "beta": "公测",
        "example_upload_report": "上传报告",
        "example_doc_name_zh": "文档中文名",
        "example_doc_name_zh_desc": "请输入文档中文名",
        "example_doc_name_en": "文档英文名",
        "example_doc_name_en_desc": "请输入文档英文名",
        "example_doc_link": "文档链接",
        "example_doc_lark_link": "请输入飞书云文档链接",
        "example_report_tag": "报告标签",
        "example_business_line": "请选择业务线",
        "example_result": "结论",
        "example_result_desc": "请输入结论",
        "example_remark": "备注",
        "example_remark_desc": "请输入备注",
        "example_upload_consist": "连续上传",
        "example_cancel": "取消",
        "example_confirm": "确定",
        // page seven: Web application
        "application_title": "打造现代 Web 应用",
        "application_subtitle": "使用 Semi 与现代操作系统、浏览器更贴近的设计语言",
        "coze": "新一代一站式 AI Bot 开发平台，无论你是否有编程基础，都可以在扣子平台上快速搭建基于 AI 模型的各类问答 Bot，发布到豆包、飞书、微信客服、微信公众号多个渠道，与更多人一起玩转 AI。",
        "feishu_program": "飞书项目是 2022 年春季飞书发布的单品，支持大型团队将复杂项目拆解流程并可视化，直观呈现协作标准，让成员明晰权责，轻松掌握上下游信息。",
        "douyin_creator": "抖音创作服务平台是抖音创作者的专属服务平台，支持用户作为创作者和管理机构两种登录方式，提供多种功能助力用户高效运营",
        "anyweb": "Anyweb 是一个免费的网站构建器，可以轻松创建专业网站。无需编程技能，您可以通过 Anyweb 拖放编辑器快速轻松地设置自定义网站。",
        "star_river": "炙热星河是抖音旗下一站式音乐人服务平台，在音乐的·浩瀚星河，让有温度的音乐创作人入驻，为优秀音乐作品创造价值。",
        "cap_cut": "剪映黑罐头连接视频创作产业链中的所有参与者，构建素材库（模板、道具、音效、花字、特效等），提供素材分享、合作交流、商业变现等服务。",
        // page eight: deep content
        "content_title": "内容深度解读",
        "content_subtitle": "了解我们在无障碍、主题定制、自动化方案背后的思考",
        "content_a11y": "Semi Design 中的无障碍设计",
        "content_ally_info": "「不支持 Accessibility 的前端开源 UI 组件库，就是灾难」",
        "content_theme": "深入浅出 Semi 主题化方案",
        "content_theme_info": "兼容多元的品牌语言和产品形态，避免无意义的重造",
        "content_d2c": "Semi D2C 设计转代码的演进之路",
        "content_d2c_info": "用先进的工具连接设计师与开发者",
        "content_d2c_openday": "字节跳动开源 OpenDay 主题分享",
        "content_d2c_info_openday": "D2C 设计稿转代码深度解读",
        "content_test": "Semi Design 如何做质量保障",
        "content_test_info": "综合运用 Unit Test、E2E Test、Visual Test 保障组件库稳定性",

        // page nine: comment
        "grow_with_users": "与用户共同成长",
        "grow_with_users_description": "Semi Design 重视我们的用户，加入并助力我们不断完善",
        "download": "下载",
        "contributor": "贡献者",
        "thanks": "特别鸣谢",
        "access_is_simple_and_easy_to_use": "接入简单易上手；Semi UI 样式美观，主题统一；API 丰富全面。",
        "beautiful_style_and_unified_theme": "样式美观，主题统一；",
        "rich_and_comprehensive_": "丰富全面。",
        "front_end__bytedance": "前端，字节跳动",
        "the_components_are_quite_complete__covering_a_wide_range_and_the_overall_style_i_e10d9214b403886d249f00b8c4dbb975": "Semi 组件挺全的，覆盖的比较广泛，整体风格也不错。",
        "design_resources_are_obviously_helpful_to_improve_efficiency_": "设计资源对提效有明显帮助。",
        "design__bytedance": "设计，字节跳动",
        "there_are_many_other_business_uses_within_the_company__there_are_more_sample_ref_c5fe7051d5fbf1a547084c91f7c4fd8e": "Semi 有很多公司内的其他业务使用，有比较多的样例参考，我们依托 Semi 的组件设计，参考其他业务平台的设计方案，总结了自己的前端规范，统一平台的交付标准。",
        "component_design__referring_to_the_design_schemes_of_other_business_platforms__s_e47da10ff860ba8b9db1268c06011006": "的组件设计，参考其他业务平台的设计方案，总结了自己的前端规范，统一平台的交付标准。",
        "product_manager__bytedance": "产品经理，字节跳动",
        "super_good!_strong_push_": "Semi 超级好用！强推。",
        "as_an_excellent_benchmarking_industry": "Semi 作为对标业界优秀的 UI 库来说做的确实很不错了，对于问题的响应速度，问题的解决效率都有很好的保障。",
        "the_library_did_a_really_good_job__it_has_a_good_guarantee_for_the_corresponding_61cb34deb7e27e6561dd9a5bce00de72": "库来说做的确实很不错了，对于问题的响应速度，问题的解决效率都有很好的保障。",
        "easy_to_use__beautiful_style_": "Semi Design 使用方便，样式美观。",
        "uniform_style_and_high_fidelity_prototype_facilitate_communication_with_front_en_95d0c0ccece05c104b98ac0dae9fb53b": "Semi 统一的样式，高保真的原型便于与前端同学进行沟通。",
        "the_documentation_is_very_detailed_and_the_details_of_the_components_are_well_th_aadc51a1122c41cf69ebd4b15e83e864": "文档非常详细，对组件的细节思考非常充足。",
        // page ten: resource
        "resource_subtitle": "今天起，在下一个项目中使用 Semi Design",
        "home.resource.rd": "我是开发者",
        "home.resource.rd.desc": "基于设计语言开发，能够在线调试的 React UI 组件库，帮助开发者高效构建应用",
        "component_documentation": "组件文档",
        "home.resource.design": "我是设计师",
        "home.resource.design.desc": "基于 Figma 构建，与组件库代码完全对齐的设计资源，使用 Semi 设计出色的中后台企业应用",
        
        "user": "用户",
        // "smart_translation": "智能翻译",
        // "live_open_platform": "直播开放平台",
        // "experience_monitoring": "体验监测",
        // "content_security": "内容安全",
       
       
        "learn_more": "了解更多",
        // "based_on": "基于",
        // "real_component_code_design__massive_page_template_front_end_code_one_click": "真实组件代码设计，海量页面模板前端代码一键转",
        "under_construction": "建设中",
        

        // "excellent_design_of_mid_background_enterprise_applications": "设计出色的中后台企业应用",

        // "home.pro.title": "Semi Design 设计稿转代码",
        // "home.pro.desc": "基于 40+ 真实组件代码设计，海量页面模板前端代码一键转",
        // "home.pro.start": "快速开始",
        // "beta": "公测",

        "default": "默认",
        "design": "设计",
        "feishu_universe_design_theme": "飞书 Universe Design 主题",
        "douyin_creative_service_theme": "抖音创作服务主题",
        "capCut_theme": "剪映主题",
        "volcengine_theme": "火山引擎主题",
        "system_notification": "系统通知",
        "semi_design_share_2code": "#Semi Design2Code# 技术分享开讲啦！根据活动规则，恭喜 13 位...",
        "semi_design_share_presentation": "Semi Design 分享演示文稿",
        "beijing__china": "中国 北京",
        "douyin_certification": "官方认证",
        "chief_foodie__good_at_algorithms__especially": "首席吃货，擅长算法，特别是",
        "video_compression_algorithm": "视频压缩算法",
        "official_topics": "官方话题",
        "commercialization": "商业化",
        "big_v": "大 V",
        "private_message_management": "私信管理",
        "apple_account": "Apple 账号",
        "google_account": "Google 账号",
        "douyin_assistant": "抖音小助手",
        "ulike_assistant": "轻颜小助手",
        "placeholder_text": "占位文本",
        "send": "发送",
        "sender": "发信人",
        "private_message_content": "私信内容",
        "time_of_dispatch": "发信时间",
        "theme_store": "主题商店",

        'd2c.advanced.title': '现代化的研发交付方式',
        'd2c.advanced.feature1.title': '支持识别设计系统组件',
        'd2c.advanced.feature1.description':
            '无需频繁翻阅组件文档，即可快速得到组件代码。支持 Semi 组件识别，也支持接入其他设计系统组件。',
        'd2c.advanced.feature2.title': '轻松定制转码结果',
        'd2c.advanced.feature2.description':
            '提供了中间产物 DSL 和 19+ 钩子函数，支持用户定制化转码结果，比如转码为 Vue、Svelte 代码，自定义模板代码等。',
        'd2c.advanced.feature3.title': '快速封装提效工具',
        'd2c.advanced.feature3.description':
            '支持 OPEN API 或 Node SDK 形式脱离 Figma 插件使用 D2C 能力，可将 D2C 能力嵌入自建平台或工具，比如搭建平台，VS Code 插件等。',
        'd2c.advanced.view': '立即查看',
        'd2c.advanced.comingSoon': '暂未开放，敬请期待',
    },
};

export default appLocale;
