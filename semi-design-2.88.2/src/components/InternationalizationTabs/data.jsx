// 概念介绍
const conceptIntroduction = `
## 一. WHY｜为什么我们要做 i18n？
随着全球化进程的加快，国际贸易和交流日益频繁，i18n 国际化设计是适应这一趋势的必要举措。国际化产品的用户来自不同国家，因此在使用同一款产品的时候，不同国家的用户会有不同的偏好和行为。我们通过调研得知，不同地区因为文化、语言、市场、习惯、政策、技术的影响而形成了独特而多样的设计规则：

<div style={{ display: 'flex', gap: 24, marginBottom: '1.46em'}}>
    <ImageCard 
        icon={<IconArticle />}
        title="文化差异"
        image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n1.png'
        description={
            <p>
                各国文化差异对产品设计有着广泛而深刻的影响。基于荷兰著名社会心理学家、人类学家吉尔特・霍夫斯泰德（Geert Hofstede）的文化六维度理论，我们可以更好地预测和解释不同文化背景下人们的行为、价值观和决策方式，从而为产品设计提供底层方法论基础。
            </p>
        }
    />
    <ImageCard 
        icon={<IconTextRectangle />}
        title="语言差异"
        image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n2.png'
        description={
            <p>
                基于美国跨文化研究学者爱德华・T・霍尔（Edward T. Hall）的理论来看，文化可以分为高语境文化（High-Context Culture）和低语境文化（Low-Context Culture）。我们需要根据不同文化背景下用户的特点和需求做有针对性的设计，提高产品交互语言和信息层面的可用性。
            </p>
        }
    />
    <ImageCard 
        icon={<IconBriefcase />}
        title="市场差异"
        image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n3.png'
        description={
            <p>
                不同国家和地区的经济发展水平差异显著，直接决定了当地用户的消费能力和消费偏好；各个国家和地区都有其特定的政策法规和行业标准，这些要求对国际化设计有着严格的约束和规范；不同市场的竞争激烈程度和格局各不相同……这些都对国际化设计提出了不同的挑战和机遇。
            </p>
        }
    />
</div>
<div style={{ display: 'flex', gap: 24, marginBottom: '1.46em'}}>
    <ImageCard 
        icon={<IconLikeHeart />}
        title="习惯差异"
        image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n4.png'
        description={<p>用户交互习惯在国际化设计中扮演着举足轻重的角色。比如不同地区的用户对操作手势的熟悉程度和偏好有所不同；界面布局和导航的习惯因文化的不同而有所差异等等。结合这些习惯进行设计决策，可以打造出更符合用户需求和使用习惯的国际化产品。</p>}
    />
    <ImageCard 
        icon={<IconSafe />}
        title="政策差异"
        image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n5.png'
        description={<p>各国政策在知识产权保护、贸易协定、技术标准以及环保等方面的规定对国际化设计有重要影响。比如不同国家的知识产权保护政策为国际化设计划定了清晰的创新边界；技术标准和法规政策对产品设计的技术要求也做出了明确规定；贸易政策也可以引导设计风格和趋势的发展等等。</p>}
    />
    <ImageCard 
        icon={<IconCustomize />}
        title="技术差异"
        image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n6.png'
        description={<p>各国技术发展水平也有较大的差异。技术发展水平较高的国家和地区往往拥有先进的设计软件和工具及前沿的设计方法和理念。而在技术发展水平较慢的地区，用户可能更关注产品的基本功能和实用性，对新技术的接受程度较低。这就要求我们进行有针对性的设计调整。</p>}
    />
</div>
我们在：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/JiRTwdBmZifcJEkar7Kcl19Rn8d">i18n 设计差异根因</a> 一文中，对以上因素如何影响国际化设计进行了详细的解读，通过了解这些影响因素，我们可以更好地从本质上熟悉并运用国际化设计。


## 二. i18n 和 l10n 的区别与联系
我们可以将国际化和本地化的定义和侧重总结如下：

<div style={{ display: 'flex', gap: 24, marginBottom: '1.46em' }}>
    <TextCard
        color="blue"
        title="国际化 Internationalization (i18n)"
        description={[
            "定义：选择各种文化中都可以接受的设计，目的是在设计中避免特定文化用户无法使用或者产生较差用户体验",
            "侧重：如何避免负面体验",
            "目的：国际化是本地化的基础，使得“本地化”工作可以在不重新开发产品的前提下高效进行。",
        ]}
    />
    <TextCard
        color="cyan"
        title="本地化 Localization (l10n)"
        description={[
            "定义：对一个特定文化进行深入研究，以设计更符合当地用户习惯的设计，即使这种设计无法被其他文化的用户所理解",
            "侧重：如何获得最佳的体验",
            "目的：本地化是国际化的延伸，为国际化产品消除在特定地区的所有使用障碍。",
        ]}
    />
</div>

但是“国际化”和“本地化”并不是互斥的。虽然国际化的目标是“寻找各个文化中的公约数”，但是在有些情况下，各种文化间并不存在“公约数”，因此此时的“国际化”就变成了“本地化的集合”，即：有交集时取交集，无交集时取并集。我们可以在 i18n 和 l10n 的区别与联系 一文中对于两者有更详细的描述。

而具体到实际的本地应用，我们在：国际化到本地化的桥梁 locale 一文中有详细的说明，介绍了如何通过 locale 来判断用户语言、地区和文化偏好，从而设定正确的展示方式、日期格式、小数点符号等，以完成国际化到本地化的衔接。

你也可以直接查看我们的<a href="/zh-CN/other/locale" target="_blank">国际化组件 LocaleProvider</a>，用于为 Semi 组件提供多语言支持。
`;

// 设计原则
const designPrinciples = `
<div style={{ marginTop: '30px' }}></div>
为了保证国际化的设计思维能够在设计中被正确的应用，我们总结出了三个设计原则，分别是：多元包容（Inclusiveness）；本地适配（Local Adaptive）和可扩展性（Scalability）。

<ImageList
    title="多元包容｜Inclusiveness"
    image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/principle1.png"
    description={
        <>
            产品设计应该考虑、尊重并适应不同语言、文化等多方面的差异，避免因设计忽视导致的排斥或误解，确保产品在全球范围内具备友好、舒适的用户体验。
            <ul>
                <li>设计时应寻找、采用各种文化均能接受的共性设计方案。</li>
                <li>避免使用具有文化歧义或敏感含义的图标、颜色、语言表达。</li>
            </ul>
        </>
    }
/>
<ImageList
    title="本地适配｜Local Adaptive"
    image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/principle2.png"
    description={
    <>
        产品设计应充分理解并响应各地语言、文化习惯差异，并可以根据用户语言、地理位置、偏好设置进行自动针对性调整，让用户感到“这就是为我设计的”。
            <ul>
                <li>时间、货币、度量单位、表单等格式和内容根据用户语言、地理位置、偏好设置自动适配。</li>
                <li>考虑文化偏好进行图像、本地节庆、色彩与视觉表达的调整</li>
            </ul>
        </>
    }
/>
<ImageList
    title="可扩展性｜Scalability"
    image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/principle3.png"
    description={
        <>
            产品功能与架构设计需具备开放性与延展性，不应只考虑设计时所使用的语言文化，也应考虑到各种不同语言文化的可能性，并预留足够的拓展空间。
            <ul>
                <li>UI 布局和组件需支持多语言动态扩展，如德语句子较长，应避免固定宽度按钮。</li>
                <li>架构上支持模块化设计，方便未来快速增加语言、功能或区域设置。</li>
                <li>文本和图片内容、组件分离，确保所有文案都可以进行多语言适配。</li>
            </ul>
        </>
    }
/>

`;

// 设计规范 - 文字设计规范
const textDesignSpecification = `
在国际化设计中，文字设计需要遵循一系列规范，以确保文字在不同语言和文化背景下都能准确传达信息、易于阅读且符合当地审美。
## 一. 文字设计与字体选择
在国际化设计中，不同语言的文字结构、阅读习惯和字体呈现会对界面布局与用户体验产生显著影响。为了便于国际化场景分类，Google 在其字体设计中将所有语言字母系统分为三个类型：**类英语文字、密集文字和高文字**。
<ul className="md markdown gatsby-ul">
    <li className="md markdown gatsby-li">**英语文字 English-like**：用于欧洲、非洲的大部分语言（如英语、希腊语、西里尔语、希伯来语、亚美尼亚语、格鲁吉亚语等）的字符类型。</li>
    <li className="md markdown gatsby-li">**高文字 Tall**：用于南亚、东南亚语言（如阿拉伯语、印地语、泰卢固语、泰语、越南语等）的字符类型。</li>
    <li className="md markdown gatsby-li">**密集文字 Dense**：用于中文、日文、朝鲜文的字符类型。</li>
</ul>

<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font1.png" alt="文字设计" />


这三种类型的文字会在**字形的高度和文案的长度**上存在一定的差异，相关规范的详细内容可以查看文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/XzQWwuZhRiuUjYkTqrIcJr3InSh">i18n 文字设计规范</a>


## 二. 页面框架与排版布局
国际化产品设计的界面布局应该充分体现可扩展性原则，主要表现在以下六个方面 ：

一是**栅格框架的适配布局**，不依赖某一种特定的语言长度，而要充分考虑到不同语言的差异进行适配：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font2.png" alt="栅格框架的适配布局" />


二是**局部文字的溢出处理**，在局部特殊场景中对文本内容要考虑到溢出情况的处理方式，如：折行、省略、滚动等。在 Semi 的组件设置上，我们**未来**也对组件的排版进行了优化设计，避免出现因文字过长而被裁剪的问题。

三是**特殊语种的阅读顺序**，阿拉伯语的阅读顺序为 RTL，界面设计需要进行镜像处理，详见 <a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy">i18n RTL 设计规范</a>。
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font3.png" alt="特殊语种的阅读顺序" />

四是**表单场景的内容排序**，由于各种文字长度差异较大，我们推荐表单采用上下布局方式，同时也要将本文和表单控件区分开，避免混排。更多设计建议详见：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/XzQWwuZhRiuUjYkTqrIcJr3InSh#share-XyWUdRl2GoP2wGxcYgflg3dwgOb">表单设计规范</a>。
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font4.png" alt="表单场景的内容排序" />

五是**多种语言的文字混用**，界面整体需要跟随主语言的习惯和方式，但是混排语言内部跟随混排语言的习惯和方式。更多设计建议详见：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/XzQWwuZhRiuUjYkTqrIcJr3InSh#share-YgNAdOeFiox7KlxLEpSlhhBxgFg">多种语言文字混用设计规范</a>
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font5.png" alt="多种语言的文字混用" />

六是**图片文字的分离原则**，将所有可本地化的文本内容从代码中分离，存储在独立的资源文件中，便于翻译和维护。更多设计建议详见：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/XzQWwuZhRiuUjYkTqrIcJr3InSh#share-O2HfdEcRioSfP4xPxkAlKMLvgZd">内容分离原则</a>
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font6.png" alt="图片文字的分离原则" />
`;

// 设计规范 - 图形设计规范
const graphicDesignSpecification = `
在全球化产品设计中，图形（图标、插图、图像等）的适配是 i18n 的重要环节。本文档旨在说明不同语言和文化对视觉符号的解读差异，并制定统一的图形设计规范，可确保产品在全球市场的可用性和文化包容性。

## 一. 图形设计的注意事项
国际化产品中的图形设计有以下四个注意事项，更多设计案例可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/G2guwXwjniA1WEkGyVmcYFm8nbh">i18n 图形设计规范</a>
<div style={{ display: 'flex', gap: 24, marginBottom: '1.46em' }}>
    <ColorCard
        color="blue"
        icon={<IconBulb />}
        title="保证可理解性"
        description="在选择图形时，优先选择在全球范围内有固定认知的图像和符号，使用更为通用、简洁、清晰的图形风格，来帮助用户减少认知成本。"
    />
    <ColorCard
        color="green"
        icon={<IconPuzzle />}
        title="适配本地文化"
        description="在一些图形尤其是人物形象，可以根据目标市场使用符合目标地区文化和认知的图像，有助于用户更容易地理解产品。"
    />
    <ColorCard
        color="orange"
        icon={<IconAlertTriangle />}
        title="规避敏感内容"
        description="一些形状、颜色、手势等在不同文化中可能有截然不同的含义，设计师需要了解并尊重这些文化差异，以避免造成不必要的误解或冒犯。"
    />
    <ColorCard
        color="violet"
        icon={<IconTextRectangle />}
        title="建议图文分离"
        description="我们在视觉设计图中尽量不要放置具体的文案。在开发时，研发确保不要将文字直接嵌入至图片，而使用代码实现，便于替换。"
    />
</div>

## 二. 色彩及图形的使用规范
### 色彩（Color）使用规范
在色彩的使用过程中，我们总结出了以下三点通用规范：
<ColorList
    color="violet"
    title="1.遵循颜色的通用语义"
    description="全世界范围内对于红、黄、蓝、绿这几种颜色已经具有普遍的、通用的认知，在设计中可以直接取用规范色值来传达一定的信息。"
/>
<ColorList
    color="violet"
    title="2.注意颜色的地域差异"
    description="在不同国家和地区，相同颜色可能具有不同的文化含义，应用时需谨慎评估其特殊含义及敏感性，以确保用户不产生困惑或感到不适。"
/>
<ColorList
    color="violet"
    title="3.参考颜色的固定搭配"
    description="有些事物具有固定的颜色搭配，可能和设计师以往所熟悉的颜色搭配认知不同，因此在设计时需要前置做好调研。"
/>
更多设计案例可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/G2guwXwjniA1WEkGyVmcYFm8nbh">颜色使用规范</a>


### 图标（Icon & symbol）使用规范
全球化设计中的图标与符号不仅是功能载体，更是文化沟通的桥梁。它们的选用需兼顾文化普适性、功能传达和技术适配等多重维度，我们总结出了以下两点通用规范：
<ColorList
    color="indigo"
    title="1.遵循各国文化的普适性"
    description="尽量选用较为通用的图标与符号，需要保证信息能跨越语言与地域达成视觉共识，同时需要针对不同语言版本调整图标布局。"
/>
<ColorList
    color="indigo"
    title="2.保证图形语义的清晰性"
    description="遵循 “ 5 秒原则”，即用户应在 5 秒内理解图标的含义。若需解释，则需优化或补充文字进行兜底。同一产品内的图标需保持线宽、配色、风格的统一性。"
/>
更多设计案例可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/G2guwXwjniA1WEkGyVmcYFm8nbh#share-XlpidxNlkosDdsxFFnNlanREgWd">图标使用规范</a>

### 图片（Image）使用规范
全球化设计中的图片选择需要注意多元、包容，友好、亲切，我们总结出了以下两点通用规范：
<ColorList
    color="blue"
    title="1.尽可能选用无国界图片"
    description="在图像的使用上，选择全球范围内通用的、公开的、可被接受的图像，避免地域限制。"
/>
<ColorList
    color="blue"
    title="2.使用多元化的人物形象"
    description="除非针对于本地化市场，在国际化设计中，尽量展示多元化的肤色，避免单一肤色。"
/>
更多设计案例可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/G2guwXwjniA1WEkGyVmcYFm8nbh#share-GluWdlhmloWbDgxWYAMlHJYkgHe">图片使用规范</a>

### 表情包（Emoji）使用规范
全球化设计中的表情包在风格上应注意积极阳光，体现包容与种族友好，使用通用认知的 emoji，而不使用隐喻。我们总结出了以下两点通用规范：
<ColorList
    color="cyan"
    title="1.遵循包容与多元原则"
    description="Emoji 尽可能不要产生对于种族的偏好或歧视，应做到种族友好。同一产品中，尽可能使用不带有肤色特征的同一 Emoji 形象。"
/>
<ColorList
    color="cyan"
    title="2.注意各地区理解差异"
    description="不同地区及文化的用户对于 Emoji 的认知理解上存在差异，在使用时，尽量根据场景选择具有通用认知的表情与物体，减少细分场景中多 Emoji 的使用。"
/>
更多设计案例可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/G2guwXwjniA1WEkGyVmcYFm8nbh#share-VpNwdmNG6oM1xQx8tF3lmeFjglh">表情包使用规范</a>
`;

// 设计规范 - 信息呈现规范
const informationPresentationSpecification = `
国际化设计中不同国家的时间、日期、数字、度量等都各不相同，需要根据不同国家来展示不同的格式。

## 一. 时间及日期格式规范
### 日期格式
许多国家有自己的传统日期格式，但同时也支持国际标准格式。国际标准格式如下：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format1.png" alt="日期格式" />

更多设计规范可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-XB6Xda5bsoC0GpxxuQjlaTI2g0b">日期格式规范</a>

### 时区及时间格式
时间的国际标准格式如下：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format2.png" alt="时间格式" />

时区的国际标准格式如下：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format3.png" alt="时区格式" />

更多设计规范可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-LfaodgtvroTjenxHwtFlH4NDg6Z">时区及时间格式规范</a>

## 二. 数字及货币展示规范
### 数字格式
不同国家和地区的数字，千分位符和小数点有不同的表述方式：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format4.png" alt="数字格式" />


更多使用规则可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-K6vidvdGPoAfuKxH9K7lhoMXgBb">数字格式规范</a>

### 货币格式
货币和语言、国家都不是一一对应的关系，同一种语言可能会属于不同国家，使用不同的货币。另外，货币代码、货币符号和货币单位的使用方式都有不同的规则：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format5.png" alt="数字格式" />

更多使用规则可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-HYX5dkvIbompivxEBgiliR3VgLd">货币格式规范</a>

## 三. 度量单位展示规范
全世界绝大多数国家采用都采用国际单位制（SI），只有美国采用英制单位，缅甸采用缅甸传统计量单位，但目前缅甸政府在推动使用国际单位制：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format6.png" alt="度量单位展示规范" />

更多使用规则可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-GmBjd4pL9o1V5yxIaW7lF1djgSe">度量单位使用规范</a>

## 四. 联系方式展示规范
在国际化设计中，联系方式的规范需要考虑不同国家和地区的文化、语言和习惯差异，以确保信息的准确传达和易于理解：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format7.png" alt="联系方式展示规范" />

更多使用规则可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-KdY9dNvBxoP1Coxbgu5l07Hzgsh">联系方式使用规范</a>
`;

// 设计规范 - RTL 设计规范
const rtlDesignSpecification = `
由于阅读顺序习惯的影响，RTL 语言的界面设计与 LTR 语言的界面设计存在显著差异。设计师需要了解哪些元素需要/无需进行 RTL 适配，并提供统一的 RTL 适配规范与物料，确保设计在 RTL 语言环境下的用户体验一致性。
## 一. RTL 设计的基本方法
国际化产品中的 RTL 设计有以下四个基本方法：

<div style={{ display: 'flex', gap: 20, }}>
    <ColorImageCard
        color="blue"
        icon={<IconFlipHorizontal />}
        title="镜像翻转"
        image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL1.png"
        description="直接对页面整体框架和内容进行镜像翻转。"
    />
    <ColorImageCard
        color="cyan"
        icon={<IconAppCenter />}
        title="局部混搭"
        image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL2.png"
        description="局部文本布局情况需要根据场景进行特殊处理。"
    />
    <ColorImageCard
        color="green"
        icon={<IconListView />}
        title="保持不变"
        image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL3.png"
        description="具有国际标准或统一认知的元素展示方式保持不变。"
    />
    <ColorImageCard
        color="lime"
        icon={<IconSync />}
        title="灵活转换"
        image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL4.png"
        description="有些图标不能单纯镜像，需要对局部进行灵活修改。"
    />
</div>

## 二. RTL 设计的具体规则
### 页面布局规范
在 RTL 文本环境下，整体的页面布局需要镜像，以保证信息按顺序合理进行展示。尤其注意列表的排布顺序，以确保信息按照逻辑顺序排列，符合用户的阅读习惯：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL-rule1.png" alt="RTL 页面布局规范" />

更多设计规则可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy#share-QNSzdDbxLoMy4axWqkhleAQogHc">RTL 布局规范</a>

### 文本排版规范
在 RTL 的设计中，我们可以从文本的对齐方式、文本的呈现顺序两个方面来了解相关的设计规范：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL-rule2.png" alt="RTL 文本排版规范" />
更多设计规则可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy#share-Aogvdn7mrodrHUxJ7ymlq1Vsgmd">RTL 文本信息规范</a>

### 信息名词规范
在 RTL 的设计中，信息的呈现方式和信息的内容有很强的关联性，有些信息不需要做阅读顺序的调整，有些则需要：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL-rule3.png" alt="RTL 信息名词规范" />

更多设计规则可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy#share-OIrqd7jLco4XmAxle4elSdFpg3d">RTL 信息名词规范</a>

### 视觉元素规范
在 RTL 的设计中，我们需要根据图片、图标和其他各类元素的含义和应用场景来判断是否需要更改图标的方向：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL-rule4.png" alt="RTL 视觉元素规范" />

更多设计规则可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy#share-EGq0dIcoYoKOLNxk5ZPlNB5Ngpe">RTL 图标和图片规范</a>

### 交互操作规范
在 RTL 的设计中，交互操作也通常需要换方向，以符合用户的阅读和操作习惯，提升用户体验：
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL-rule5.png" alt="RTL 交互操作规范" />

更多设计规则可以阅读文档：<a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy#share-CiowdLCZ2oNKLjx0yyql4rofgMd">RTL 交互操作规范</a>
`;

// Concept Introduction EN
const conceptIntroductionEn = `
## 1. WHY｜Why do we do i18n?
With the acceleration of globalization, international trade and exchanges are becoming more frequent. i18n international design is a necessary measure to adapt to this trend. Users of international products come from different countries. Therefore, when using the same product, users from different countries will have different preferences and behaviors. Through research, we learned that different regions have formed unique and diverse design rules due to the influence of culture, language, market, habits, policies, and technology:

<div style={{ display: 'flex', gap: 24, marginBottom: '1.46em' }}>
    <ImageCard
        icon={<IconArticle />}
        title="Cultural Differences"
        image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n1.png'
        description={
            <p>
            Cultural differences between countries have a wide and profound impact on product design. Based on the six-dimensional theory of culture by Geert Hofstede, a famous Dutch social psychologist and anthropologist, we can better predict and explain people's behaviors, values, and decision-making methods in different cultural backgrounds, thereby providing an underlying methodological foundation for product design.
            </p>
        }
    />
<ImageCard
icon={<IconTextRectangle />}
title="Language Difference"
image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n2.png'
description={
<p>
Based on the theory of Edward T. Hall, an American cross-cultural researcher, culture can be divided into high-context culture and low-context culture. We need to make targeted designs based on the characteristics and needs of users in different cultural backgrounds to improve the usability of product interaction language and information levels.
</p>
}
/>
<ImageCard
icon={<IconBriefcase />}
title="Market Differences"
image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n3.png'
description={
<p>
The economic development levels of different countries and regions vary significantly, which directly determines the consumption capacity and consumption preferences of local users; each country and region has its own specific policies, regulations and industry standards, which have strict constraints and norms on international design; the intensity and pattern of competition in different markets are different... These have brought different challenges and opportunities to international design.
</p>
}
/>
</div>
<div style={{ display: 'flex', gap: 24, marginBottom: '1.46em'}}>
<ImageCard
icon={<IconLikeHeart />}
title="Habit Differences"
image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n4.png'
description={<p>User interaction habits play a pivotal role in international design. For example, users in different regions have different familiarity and preferences for operation gestures; interface layout and navigation habits vary due to different cultures, etc. Combining these habits to make design decisions can create international products that better meet user needs and usage habits. </p>}
/>
<ImageCard
icon={<IconSafe />}
title="Policy Differences"
image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n5.png'
description={<p>The policies of various countries in terms of intellectual property protection, trade agreements, technical standards and environmental protection have an important impact on international design. For example, the intellectual property protection policies of different countries set clear innovation boundaries for international design; technical standards and regulatory policies also make clear provisions for the technical requirements of product design; trade policies can also guide the development of design styles and trends, etc. </p>}
/>
<ImageCard
icon={<IconCustomize />}
title="Technology Differences"
image='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/whyi18n6.png'
description={<p>There are also large differences in the level of technological development among countries. Countries and regions with higher levels of technological development often have advanced design software and tools as well as cutting-edge design methods and concepts. In regions with slower technological development, users may pay more attention to the basic functions and practicality of products and have a lower degree of acceptance of new technologies. This requires us to make targeted design adjustments. </p>}
/>
</div>
In the article: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/JiRTwdBmZifcJEkar7Kcl19Rn8d">Root causes of i18n design differences</a>, we have made a detailed interpretation of how the above factors affect international design. By understanding these influencing factors, we can better understand and apply international design from the essence.

## 2. The difference and connection between i18n and l10n
We can summarize the definition and focus of internationalization and localization as follows:

<div style={{ display: 'flex', gap: 24, marginBottom: '1.46em' }}>
    <TextCard
        color="blue"
        title="Internationalization (i18n)"
        description={[
                "Definition: Choose a design that is acceptable in all cultures, with the goal of avoiding the inability of users of a specific culture to use the design or causing a poor user experience",
                "Focus: How to avoid negative experiences",
                "Purpose: Internationalization is the foundation of localization, allowing localization work to be carried out efficiently without redeveloping the product.",
        ]}
    />
    <TextCard
        color="cyan"
        title="Localization (l10n)"
        description={[
            "Definition: Deeply study a specific culture to design a design that is more in line with the habits of local users, even if this design cannot be understood by users of other cultures",
            "Focus: How to get the best experience",
            "Purpose: Localization is the extension of internationalization, eliminating all usage barriers for internationalized products in specific regions.",
        ]}
    />
</div>

However, "internationalization" and "localization" are not mutually exclusive. Although the goal of internationalization is to "find the common denominator in each culture", in some cases, there is no "common denominator" between various cultures, so "internationalization" at this time becomes a "set of localizations", that is, take the intersection when there is an intersection, and take the union when there is no intersection. We can have a more detailed description of the two in the article "The difference and connection between i18n and l10n".

As for actual local applications, we have a detailed description in the article "locale, the bridge from internationalization to localization", which introduces how to use locale to determine the user's language, region and cultural preferences, so as to set the correct display method, date format, decimal point symbol, etc., to complete the connection from internationalization to localization.

You can also directly check our <a target="_blank" href="/en-US/other/locale">internationalization component LocaleProvider</a> to provide multi-language support for Semi components.
`;

// Design principles EN
const designPrinciplesEn = `
<div style={{ marginTop: '30px' }}></div>
In order to ensure that international design thinking can be correctly applied in design, we have summarized three design principles, namely: inclusiveness; local adaptability and scalability.

    <ImageList
        title="Inclusiveness"
        image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/principle1.png"
        description={
            <>
                Product design should consider, respect and adapt to differences in different languages, cultures and other aspects, avoid exclusion or misunderstanding caused by design neglect, and ensure that the product has a friendly and comfortable user experience worldwide.
                <ul>
                    <li>When designing, we should find and adopt common design solutions that are acceptable to all cultures. </li>
                    <li>Avoid using icons, colors, and language expressions that have cultural ambiguity or sensitive meanings. </li>
                </ul>
            </>
        }
    />
    <ImageList
        title="Local Adaptive"
        image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/principle2.png"
        description={
            <>
                Product design should fully understand and respond to the differences in language and cultural habits in different regions, and can automatically make targeted adjustments based on user language, geographic location, and preference settings, so that users feel "this is designed for me."
                <ul>
                    <li>The format and content of time, currency, measurement units, forms, etc. are automatically adapted according to user language, geographic location, and preference settings. </li>
                    <li>Adjust images, local festivals, colors and visual expressions based on cultural preferences</li>
                </ul>
            </>
        }
    />
    <ImageList
    title="Scalability"
    image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/principle3.png"
    description={
        <>
            Product function and architecture design must be open and extensible. It should not only consider the language culture used in the design, but also the possibility of various different languages ​​and cultures, and reserve enough space for expansion.
            <ul>
                <li>UI layout and components must support dynamic expansion in multiple languages. For example, fixed-width buttons should be avoided for longer German sentences. </li>
                <li>The architecture supports modular design to facilitate the rapid addition of languages, functions or regional settings in the future. </li>
                <li>Separate text and image content and components to ensure that all copywriting can be adapted to multiple languages. </li>
            </ul>
        </>
    }
    />

`;

// Text Design Specification
const textDesignSpecificationEn = `
In international design, text design needs to follow a series of specifications to ensure that text can accurately convey information, be easy to read, and conform to local aesthetics in different languages and cultural backgrounds.
## 1. Text Design and Font Selection
In international design, the structure, reading habits, and font presentation of different languages will significantly impact interface layout and user experience. To facilitate internationalization scenario classification, Google divides all language alphabetic systems into three types: **English-like, Tall, and Dense**.
<ul className="md markdown gatsby-ul">
    <li className="md markdown gatsby-li">**English-like**：For most languages in Europe and Africa (such as English, Greek, Cyrillic, Hebrew, Armenian, Georgian, etc.).</li>
    <li className="md markdown gatsby-li">**Tall**：For South Asian and Southeast Asian languages (such as Arabic, Hindi, Telugu, Thai, Vietnamese, etc.).</li>
    <li className="md markdown gatsby-li">**Dense**：For Chinese, Japanese, and Korean characters.</li>
</ul>

<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font1.png" alt="Text Design and Font Selection" />


This type of text will have certain differences in **the height of the character shape and the length of the text**. The detailed content of the relevant specifications can be viewed in the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/XzQWwuZhRiuUjYkTqrIcJr3InSh">i18n text design specification</a>


## 2. Page Framework and Typography Layout
International product design should fully embody the principle of scalability, mainly in the following six aspects:
First, **grid frame adaptation layout**, which does not rely on a specific language length, but fully considers the differences between different languages ​​for adaptation:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font2.png" alt="grid frame adaptation layout" />

Second, **local text overflow processing**, in local special scenes, the text content should consider the overflow processing method, such as: line break, omission, scrolling, etc. In the component settings of Semi, we will also optimize the layout of components in the **future** to avoid the problem of text being cut due to excessive length.

Third, the reading order of special languages. The reading order of Arabic is RTL. The interface design needs to be mirrored. For details, see <a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy">i18n RTL design specifications</a>.
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font3.png" alt="Reading order of special languages" />

Fourth, the content sorting of form scenes. Due to the large difference in the length of various texts, we recommend that the form adopts a top-down layout. At the same time, the text and form controls should be distinguished to avoid mixing. For more design suggestions, see: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/XzQWwuZhRiuUjYkTqrIcJr3InSh#share-XyWUdRl2GoP2wGxcYgflg3dwgOb">Form Design Specifications</a>.
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font4.png" alt="Content sorting in form scenes" />

Fifth, **mixed text in multiple languages**, the overall interface needs to follow the habits and methods of the main language, but the mixed language follows the habits and methods of the mixed language. For more design suggestions, please see: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/XzQWwuZhRiuUjYkTqrIcJr3InSh#share-YgNAdOeFiox7KlxLEpSlhhBxgFg">Design specifications for mixed use of multiple languages</a>
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font5.png" alt="Mixed use of multiple languages" />

Sixth, the **separation principle of images and text**, separate all localizable text content from the code and store it in a separate resource file for easy translation and maintenance. For more design suggestions, see: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/XzQWwuZhRiuUjYkTqrIcJr3InSh#share-O2HfdEcRioSfP4xPxkAlKMLvgZd">Content separation principle</a>
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/font6.png" alt="The principle of separation of images and text" />
`;

const graphicDesignSpecificationEn = `
In the globalization product design, the adaptation of graphics (icons, illustrations, images, etc.) is an important part of i18n. This document aims to explain the differences in the interpretation of visual symbols by different languages and cultures, and to establish unified graphic design specifications to ensure the usability and cultural inclusiveness of products in the global market.

## 1. Graphic Design Considerations
There are four important considerations for graphic design in international products, more design cases can be read in the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/G2guwXwjniA1WEkGyVmcYFm8nbh">i18n graphic design specifications</a>
<div style={{ display: 'flex', gap: 24, marginBottom: '1.46em' }}>
    <ColorCard
        color="blue"
        icon={<IconBulb />}
        title="Ensure Understandability"
        description="When selecting graphics, prioritize images and symbols that have a fixed global understanding, use more universal, simple, and clear graphic styles to help users reduce cognitive costs."
    />
    <ColorCard
        color="green"
        icon={<IconPuzzle />}
        title="Adapt to Local Culture"
        description="In some graphics, especially in the case of human figures, you can use images that are consistent with the cultural and cognitive characteristics of the target market to help users better understand the product."
    />
    <ColorCard
        color="orange"
        icon={<IconAlertTriangle />}
        title="Avoid Sensitive Content"
        description="Some shapes, colors, gestures, etc. may have completely different meanings in different cultures. Designers need to understand and respect these cultural differences to avoid unnecessary misunderstandings or offenses."
    />
    <ColorCard
        color="violet"
        icon={<IconTextRectangle />}
        title="Separate Text and Images"
        description="We should avoid placing specific text in visual design diagrams. During development, developers should ensure that text is not directly embedded in images, but implemented using code, which is convenient for replacement."
    />
</div>

## 2. Color and Graphic Usage Specifications
###  Color Usage Specifications
In the process of using color, we have summarized the following three general specifications:
<ColorList
    color="violet"
    title="1. Follow the General Semantic of Color"
    description="The general, universal understanding of red, yellow, blue, and green has been established in the world. In design, you can directly use the standardized color values to convey certain information."
/>
<ColorList
    color="violet"
    title="2. Consider the Regional Differences of Color"
    description="In different countries and regions, the same color may have different cultural meanings. When applying, it is necessary to carefully evaluate its special meaning and sensitivity to ensure that users do not feel confused or uncomfortable."
/>
<ColorList
    color="violet"
    title="3. Reference the Fixed Color Combination"
    description="Some things have a fixed color combination, which may be different from the color combination that designers are familiar with. Therefore, it is necessary to do research in advance during design."
/>
More design cases can be read in the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/G2guwXwjniA1WEkGyVmcYFm8nbh">Color Usage Specifications</a>

###  Icon & symbol Usage Specifications
In globalization design, icons and symbols are not only functional carriers, but also bridges for cultural communication. Their selection needs to take into account multiple dimensions such as cultural universality, functional communication, and technical adaptation. We have summarized the following two general specifications:
<ColorList
    color="indigo"
    title="1. Follow the Universality of Cultural"
    description="Try to use more universal icons and symbols, which need to ensure that information can achieve visual consensus across languages and regions, and need to adjust the icon layout according to different language versions."
/>
<ColorList
    color="indigo"
    title="2. Ensure Clarity of Graphic Semantics"
    description="Follow the 5-second rule, that is, the user should understand the meaning of the icon within 5 seconds. If an explanation is needed, it is necessary to optimize or supplement text to provide a fallback."
/>
More design cases can be read in the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/G2guwXwjniA1WEkGyVmcYFm8nbh#share-XlpidxNlkosDdsxFFnNlanREgWd">Icon & symbol Usage Specifications</a>


###  Image Usage Specifications
In globalization design, the selection of images needs to pay attention to diversity, inclusiveness, friendliness, and intimacy. We have summarized the following two general specifications:
<ColorList
    color="blue"
    title="1. Use Images without Borders"
    description="When using images, select images that are universally accepted and publicly available in the global range to avoid regional restrictions."
/>
<ColorList
    color="blue"
    title="2. Use Diverse Character Images"
    description="Unless for local market, in international design, try to show diverse skin colors to avoid single skin color."
/>
More design cases can be read in the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/G2guwXwjniA1WEkGyVmcYFm8nbh#share-GluWdlhmloWbDgxWYAMlHJYkgHe">Image Usage Specifications</a>

###  Emoji Usage Specifications
In globalization design, the style of emoji should pay attention to positive and sunny, reflect inclusiveness and racial friendliness, use emoji with universal recognition, and avoid metaphor. We have summarized the following two general specifications:
<ColorList
    color="cyan"
    title="1. Follow the Principle of Inclusiveness and Diversity"
    description="Emoji should not produce preferences or discrimination for races as much as possible, and should be race-friendly. In the same product, try to use the same Emoji image without skin color features as much as possible."
/>
<ColorList
    color="cyan"
    title="2. Consider the Regional Differences of Emoji"
    description="There are differences in the understanding of Emoji by users in different regions and cultures. When using, try to select expressions and objects with universal recognition as much as possible according to the scene to reduce the use of multiple Emoji in细分场景。"
/>
More design cases can be read in the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/G2guwXwjniA1WEkGyVmcYFm8nbh#share-VpNwdmNG6oM1xQx8tF3lmeFjglh">Emoji Usage Specifications</a>
`;

const informationPresentationSpecificationEn = `
In international design, different countries have different times, dates, numbers, and measurements, and different formats need to be displayed according to different countries.

## 1. Time and date format specifications
### Date format
Many countries have their own traditional date formats, but they also support international standard formats. The international standard format is as follows:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format1.png" alt="Date format" />

For more design specifications, please read the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-XB6Xda5bsoC0GpxxuQjlaTI2g0b">Date format specification</a>

### Time zone and time format
The international standard format of time is as follows:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format2.png" alt="Time format" />

The international standard format of the time zone is as follows:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format3.png" alt="Time zone format" />

For more design specifications, please read the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-LfaodgtvroTjenxHwtFlH4NDg6Z">Time zone and time format specifications</a>

## 2. Number and currency display specifications
### Number format
Different countries and regions have different ways of expressing numbers, thousands and decimal points:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format4.png" alt="Number format" />

For more usage rules, please read the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-K6vidvdGPoAfuKxH9K7lhoMXgBb">Number format specifications</a>

### Currency format
There is no one-to-one correspondence between currency, language and country. The same language may belong to different countries and use different currencies. In addition, there are different rules for the use of currency codes, currency symbols, and currency units:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format5.png" alt="Number format" />

For more usage rules, you can read the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-HYX5dkvIbompivxEBgiliR3VgLd">Currency format specification</a>

## 3. Unit display specification
The vast majority of countries in the world use the International System of Units (SI), only the United States uses the Imperial system, and Myanmar uses Myanmar's traditional measurement units, but the Myanmar government is currently promoting the use of the International System of Units:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format6.png" alt="Measurement unit display specifications" />

For more usage rules, please read the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-GmBjd4pL9o1V5yxIaW7lF1djgSe">Measurement unit usage specifications</a>

## 4. Contact information display specifications
In international design, the contact information specifications need to take into account the cultural, language and customary differences of different countries and regions to ensure accurate communication and easy understanding of information:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/format7.png" alt="Contact information display specifications" />

For more usage rules, please read the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/RNuywpB7oi7hYPkNH0OceXcGnyf#share-KdY9dNvBxoP1Coxbgu5l07Hzgsh">Contact information usage specifications</a>
`;


const rtlDesignSpecificationEn = `
Due to the influence of reading order habits, the interface design of RTL language is significantly different from that of LTR language. Designers need to understand which elements need/do not need to be adapted to RTL, and provide unified RTL adaptation specifications and materials to ensure the consistency of user experience in the RTL language environment.
## 1. Basic Methods of RTL Design
There are four basic methods of RTL design in international products:

<div style={{ display: 'flex', gap: 20, }}>
    <ColorImageCard
        color="blue"
        icon={<IconFlipHorizontal />}
        title="Mirror Flip"
        image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL1.png"
        description="Directly mirror the overall framework and content of the page."
    />
    <ColorImageCard
        color="cyan"
        icon={<IconAppCenter />}
        title="Local Mix"
        image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL2.png"
        description="The local text layout needs to be specially processed according to the scene."
    />
    <ColorImageCard
        color="green"
        icon={<IconListView />}
        title="Keep Unchanged"
        image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL3.png"
        description="The display method of elements with international standards or universal recognition remains unchanged."
    />
    <ColorImageCard
        color="lime"
        icon={<IconSync />}
        title="Flexible Conversion"
        image="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL4.png"
        description="Some icons cannot be simply mirrored, and need to be modified locally."
    />
</div>

## 2. Specific Rules of RTL Design
###  Page Layout Specification
In the RTL text environment, the overall page layout needs to be mirrored to ensure that information is displayed in a reasonable order. Especially pay attention to the arrangement order of lists to ensure that information is arranged in a logical order, consistent with the reading habits of users:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL-rule1.png" alt="RTL 页面布局规范" />

More design rules can be read in the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy#share-QNSzdDbxLoMy4axWqkhleAQogHc">RTL Layout Specification</a>

### Text Layout Specification
In the RTL design, we can understand the relevant design specifications from two aspects: the alignment of text and the order of text presentation:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL-rule2.png" alt="RTL 文本排版规范" />

More design rules can be read in the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy#share-Aogvdn7mrodrHUxJ7ymlq1Vsgmd">RTL Text Information Specification</a>

### Information Noun Specification
In the RTL design, the presentation method of information and the content of information are strongly related. Some information does not need to be adjusted for reading order, while some do:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL-rule3.png" alt="RTL 信息名词规范" />

More design rules can be read in the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy#share-OIrqd7jLco4XmAxle4elSdFpg3d">RTL Information Noun Specification</a>

### Visual Element Specification
In the RTL design, we need to determine whether to change the direction of icons and images according to the meaning and application scenarios of pictures, icons and other elements:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL-rule4.png" alt="RTL 视觉元素规范" />

More design rules can be read in the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy#share-EGq0dIcoYoKOLNxk5ZPlNB5Ngpe">RTL Icon and Image Specification</a>

### Interaction Operation Specification
In the RTL design, interaction operations also need to be changed in direction to conform to the reading and operation habits of users, improving user experience:
<img className="gatsby-img" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/RTL-rule5.png" alt="RTL 交互操作规范" />

More design rules can be read in the document: <a target="_blank" href="https://bytedance.larkoffice.com/wiki/XJj9wCkU1ibmCuksSCych7c2nHy#share-CiowdLCZ2oNKLjx0yyql4rofgMd">RTL Interaction Operation Specification</a>
`;

const conceptIntroductionAnchor = [
    { title: '为什么我们要做 i18n？', url: "一. WHY｜为什么我们要做 i18n？" },
    { title: 'i18n和l10n 的区别与联系', url: "二. i18n 和 l10n 的区别与联系" }
];

const conceptIntroductionAnchorEn = [
    { title: 'Why do we do i18n', url: "1. WHY｜Why do we do i18n?" },
    { title: 'The difference and connection between i18n and l10n', url: "2. The difference and connection between i18n and l10n" }
];

const textDesignSpecificationAnchor = [
    { title: '文字设计与字体选择', url: "一. 文字设计与字体选择" },
    { title: '页面框架与排版布局', url: "二. 页面框架与排版布局" }
];

const textDesignSpecificationAnchorEn = [
    { title: 'Text Design and Font Selection', url: "1. Text Design and Font Selection" },
    { title: 'Page Framework and Typography Layout', url: "2. Page Framework and Typography Layout" }
];

const graphicDesignSpecificationAnchor = [
    { title: '注意事项', url: "一. 图形设计的注意事项" },
    { title: '色彩规范', url: "色彩（Color）使用规范" },
    { title: '图标规范', url: "图标（icon-&-symbol）使用规范" },
    { title: '图片规范', url: "图片（Image）使用规范" },
    { title: '表情包规范', url: "表情包（Emoji）使用规范" }
];

const graphicDesignSpecificationAnchorEn = [
    { title: 'Considerations', url: "1. Graphic Design Considerations" },
    { title: 'Color Specification', url: "Color Usage Specifications" },
    { title: 'Icon & Symbol Specification', url: "Icon & symbol Usage Specifications" },
    { title: 'Image Specification', url: "Image Usage Specifications" },
    { title: 'Emoji Specification', url: "Emoji Usage Specifications" }
];

const informationPresentationSpecificationAnchor = [
    { title: '时间及日期格式规范', url: "一. 时间及日期格式规范" },
    { title: '数字及货币展示规范', url: "二. 数字及货币展示规范" },
    { title: '度量单位展示规范', url: "三. 度量单位展示规范" },
    { title: '联系方式展示规范', url: "四. 联系方式展示规范" },
];

const informationPresentationSpecificationAnchorEn = [
    { title: 'Time and Date Format Specification', url: "1. Time and date format specifications" },
    { title: 'Number and Currency Display Specifications', url: "2. Number and Currency Display Specifications" },
    { title: 'Unit Display Specification', url: "3. Unit Display Specification" },
    { title: 'Contact Information Display Specifications', url: "4. Contact Information Display Specifications" },
];

const rtlDesignSpecificationAnchor = [
    { title: '基本方法', url: "一. RTL 设计的基本方法" },
    { title: '页面布局规范', url: "页面布局规范" },
    { title: '文本排版规范', url: "文本排版规范" },
    { title: '信息名词规范', url: "信息名词规范" },
    { title: '视觉元素规范', url: "视觉元素规范" },
    { title: '交互操作规范', url: "交互操作规范" },
];

const rtlDesignSpecificationAnchorEn = [
    { title: 'Basic Methods', url: "1. Basic Methods of RTL Design" },
    { title: 'Page Layout Specification', url: "Page Layout Specification" },
    { title: 'Text Layout Specification', url: "Text Layout Specification" },
    { title: 'Information Noun Specification', url: "Information Noun Specification" },
    { title: 'Visual Element Specification', url: "Visual Element Specification" },
    { title: 'Interaction Operation Specification', url: "Interaction Operation Specification" },
];




export {
    conceptIntroduction,
    designPrinciples,
    textDesignSpecification,
    graphicDesignSpecification,
    informationPresentationSpecification,
    rtlDesignSpecification,
    conceptIntroductionEn,
    designPrinciplesEn,
    textDesignSpecificationEn,
    graphicDesignSpecificationEn,
    informationPresentationSpecificationEn,
    rtlDesignSpecificationEn,
    conceptIntroductionAnchor,
    conceptIntroductionAnchorEn,
    textDesignSpecificationAnchor,
    textDesignSpecificationAnchorEn,
    graphicDesignSpecificationAnchor,
    graphicDesignSpecificationAnchorEn,
    informationPresentationSpecificationAnchor,
    informationPresentationSpecificationAnchorEn,
    rtlDesignSpecificationAnchor,
    rtlDesignSpecificationAnchorEn,
};
