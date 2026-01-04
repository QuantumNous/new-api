import React, { useCallback, useEffect, useRef } from 'react';
import withPropsCombinations from 'react-storybook-addon-props-combinations';

import Icon from '../../icons';
import Typography from '../index';
import { IconLink, IconTick, IconSetting } from '@douyinfe/semi-icons';
import {HugeData} from "./HugeData";
import { Tooltip } from '@douyinfe/semi-ui'

export default {
  title: 'Typography'
}

const { Title, Text, Paragraph } = Typography;

export const _Title = () => (
  <div>
    <Title>h1. Semi Design</Title>
    <Title heading={2}>h2. Semi Design</Title>
    <Title heading={3}>h3. Semi Design</Title>
    <Title heading={4}>h4. Semi Design</Title>
    <Title heading={5}>h5. Semi Design</Title>
    <Title heading={6}>h6. Semi Design</Title>
    <Title heading={6} link>
      h6. Semi Design
    </Title>
  </div>
);

export const _Text = () => (
  <div>
    <Text>Text</Text>
    <br />
    <Text type="secondary">Secondary</Text>
    <br />
    <Text type="warning">Warning</Text>
    <br />
    <Text type="danger">Dange</Text>
    <br />
    <Text disabled>Disabled</Text>
    <br />
    <Text mark>Default Mark</Text>
    <br />
    <Text code>Example Code</Text>
    <br />
    <Text underline>Underline</Text>
    <br />
    <Text delete>Deleted</Text>
    <br />
    <Text strong>Strong</Text>
    <br />
    <Text link>链接文本</Text>
    <br />
    <Text link={{ href: 'https://semi.design/' }}>打开网站</Text>
    <br />
    <Text link>
      <IconLink />
      网页链接
    </Text>
    <br />
    <Text size='small'>小尺寸文本</Text>
    <br />
    <Text size='normal'>普通尺寸文本</Text>
    <br />
  </div>
);

export const TextIcon = () => (
  <div>
    <Text icon={<IconLink />}>Text</Text>
    <br />
    <Text icon={<IconLink />} type="secondary">
      Secondary
    </Text>
    <br />
    <Text icon={<IconLink />} type="warning">
      Warning
    </Text>
    <br />
    <Text icon={<IconLink />} type="danger">
      Dange
    </Text>
    <br />
    <Text icon={<IconLink />} disabled>
      Disabled
    </Text>
    <br />
    <Text icon={<IconLink />} mark>
      Default Mark
    </Text>
    <br />
    <Text icon={<IconLink />} code>
      Example Code
    </Text>
    <br />
    <Text icon={<IconLink />} underline>
      Underline
    </Text>
    <br />
    <Text icon={<IconLink />} delete>
      Deleted
    </Text>
    <br />
    <Text icon={<IconLink />} strong>
      Strong
    </Text>
    <br />
    <Text icon={<IconLink />} link>
      链接文本
    </Text>
    <br />
    <Text icon={<IconLink />} link={{ href: 'https://semi.design/' }}>
      打开网站
    </Text>
    <br />
  </div>
);

TextIcon.story = {
  name: 'Text icon',
};

export const _Paragraph = () => (
  <div>
    <Paragraph>
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。
      <br />
      区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有以下优势：
      <br />
      -Semi Design
      以内容优先进行设计，这使得我们更容易搭建基于内容操作（多媒体、视频、音频等）的业务组件。
      <br />
      -更容易地自定义主题。面向公司众多不同的产品业务线，我们能够更快速地自定义具有该产品品牌风格的主题。
      <br />
      -适用国际化场景。组件设计时重视国际化场景，其中设计语言已应用在海外审核、运营等场景。
      <br />
      -效率场景加入人性化关怀。我们坚信追求高效的同时也要加入人性化的关怀，形成正向循环，追求长期的收益。
    </Paragraph>
    <br />
    <Paragraph spacing="extended">
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。
      <br />
      区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有以下优势：
      <br />
      -Semi Design
      以内容优先进行设计，这使得我们更容易搭建基于内容操作（多媒体、视频、音频等）的业务组件。
      <br />
      -更容易地自定义主题。面向公司众多不同的产品业务线，我们能够更快速地自定义具有该产品品牌风格的主题。
      <br />
      -适用国际化场景。组件设计时重视国际化场景，其中设计语言已应用在海外审核、运营等场景。
      <br />
      -效率场景加入人性化关怀。我们坚信追求高效的同时也要加入人性化的关怀，形成正向循环，追求长期的收益。
    </Paragraph>
  </div>
);

export const EllipsisSingle = () => (
  <div>
    <Paragraph ellipsis style={{ width: 350 }}>
      这是一个单行截断的例子： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ expandable: true }} style={{ width: 350 }}>
      单行截断并且支持展开：Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ expandable: true }} style={{ width: 350 }}>
      单行截断，支持展开但其实没有溢出哦
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ expandable: true, expandText: 'Show More' }} style={{ width: 350 }}>
      单行截断并且支持展开，自定义展开文本： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ expandText: 'Show More' }} style={{ width: 350 }}>
      单行截断，自定义展开文本但是不能展开哦： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ showTooltip: true }} style={{ width: 350 }}>
      单行截断，展示tooltip： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ showTooltip: true }} style={{ width: 350 }}>
      展示tooltip，但是其实没有溢出哦
    </Paragraph>
    <br />
    <Paragraph
      ellipsis={{ suffix: '喵喵喵', expandText: 'Show More', expandable: true }}
      style={{ width: 250 }}
    >
      单行截断，有suffix哦： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph
      ellipsis={{ suffix: '喵喵喵', expandText: 'Show More', expandable: true }}
      style={{ width: '50%' }}
    >
      单行截断，要自动适配宽度才可以： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <div style={{ width: 300}} >
      <Typography.Text
        copyable={true}
        link={{ href: '---' }}
        ellipsis={{
          showTooltip: {
            opts: { content: '我是一个超长超长超长超长超长超长超长超长超长的链接' },
          },
        }}
      >
      我是一个超长超长超长超长超长超长超长超长超长的链接我是一个超长超长超长超长超长超长超长超长超长的链接
      </Typography.Text>
    </div>
  </div>
);

EllipsisSingle.story = {
  name: 'Ellipsis single',
};

export const EllipsisMultiple = () => (
  <div>
    <Paragraph ellipsis={{ rows: 3 }} style={{ width: 300 }}>
      这是一个多行截断的例子： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph
      ellipsis={{ rows: 9, expandable: true, collapsible: true, collapseText: '折叠我' }}
      style={{ width: 300 }}
    >
      如果支持折叠但其实没有达到溢出的高度，仍旧会显示文本
    </Paragraph>
     <br />
    <Paragraph ellipsis={{ rows: 9, expandable: true }} style={{ width: 300 }}>
      如果支持折叠但其实没有达到溢出的高度，仍旧会显示文本
    </Paragraph>
    <br />
   <Paragraph ellipsis={{ rows: 3, expandable: true }} style={{ width: 280 }}>
      多行截断并且支持展开：Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph
      ellipsis={{ expandable: true, rows: 3, expandText: 'Show More' }}
      style={{ width: 250 }}
    >
      多行截断并且支持展开，自定义展开文本： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ rows: 3, expandText: 'Show More' }} style={{ width: 250 }}>
      多行截断，自定义展开文本但是不能展开哦： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ rows: 3, showTooltip: true }} style={{ width: 250 }}>
      多行截断，展示tooltip： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ rows: 3, showTooltip: { type: 'popover' } }} style={{ width: 250 }}>
      多行截断，展示popover： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph
      ellipsis={{ rows: 3, expandText: 'Show More', showTooltip: { type: 'popover' } }}
      style={{ width: 250 }}
    >
      多行截断，有展开文字但是不能展开所以不能展示popover： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ rows: 3, showTooltip: true }} style={{ width: 250 }}>
      展示tooltip，但是其实没有溢出哦
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ rows: 3, suffix: '喵喵喵', expandable: true }} style={{ width: 250 }}>
      多行截断，有suffix哦： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ rows: 3, suffix: '喵喵喵', expandable: true }} style={{ width: '50%' }}>
      多行截断，要自动适配宽度才可以： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ rows: 3, expandable: true }} style={{ width: 300, whiteSpace: 'pre-line' }}>
      {'这是一个多行截断的\n例子： Semi Design 是由互娱社区\n前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。 区别于其他的设计系统而言，Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有四大优势。'}
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ rows: 3, expandable: true }} style={{ width: 300, whiteSpace: 'pre-wrap' }}>
      {'这是一个多行截断的\n例子： Semi Des    ign 是由互               娱社区\n前端团队与 UED      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。 区别于其他的设计系统而言，Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有四大优势。'}
    </Paragraph>
  </div>
);

EllipsisMultiple.story = {
  name: 'Ellipsis multiple',
};

export const EllipsisChaos = () => (
  <div>
    <Paragraph ellipsis={{ rows: 3 }} style={{ width: 300 }}>
      不可以有非文本，要抛出来warning： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。
      <br />{' '}
      设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis copyable style={{ width: 350 }}>
      还可以复制哦： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph
      ellipsis
      copyable={{
        successTip: (
          <span>
            <IconTick />
          </span>
        ),
      }}
      style={{ width: 350 }}
    >
      不要复制成功了： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis link style={{ width: 350 }}>
      是一个链接呢： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph
      link
      ellipsis={{ expandable: true, rows: 3, expandText: 'Show More' }}
      style={{ width: 250 }}
    >
      是一个链接还能展开呢： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph
      link
      copyable
      ellipsis={{ expandable: true, rows: 3, expandText: 'Show More' }}
      style={{ width: 250 }}
    >
      是一个链接还能展开呢还能复制呢： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Title heading={2} ellipsis={{ showTooltip: true }} style={{ width: 250 }}>
      是个2号标题哦： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Title>
    <br />
    <Title heading={4} link ellipsis={{ showTooltip: true }} style={{ width: 250 }}>
      是个4号标题链接呢： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Title>
    <br />
    <Text
      type="warning"
      ellipsis={{ rows: 3, showTooltip: { type: 'popover' } }}
      style={{ width: 250 }}
    >
      是个警告文本呢： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Text>
    <br /><br />
    <Title
      icon={<IconLink />}
      heading={5}
      link
      ellipsis={{ showTooltip: true }}
      style={{ width: 250 }}
    >
      是个5号标题链接还有个小小的图标啦： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Title>
  </div>
);

EllipsisChaos.story = {
  name: 'Ellipsis chaos',
};

export const EllipsisCollapsible = () => (
  <div>
    <Paragraph
      ellipsis={{
        rows: 3,
        expandable: true,
        collapsible: true,
        onExpand: (bool, e) => console.log(bool, e),
      }}
      style={{ width: 300 }}
    >
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph
      ellipsis={{
        rows: 3,
        expandable: true,
        collapsible: true,
        collapseText: 'show less',
        onExpand: (bool, e) => console.log(bool, e),
      }}
      style={{ width: 300 }}
    >
      自定义的收起：Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph
      ellipsis={{
        rows: 3,
        expandable: true,
        collapsible: false,
        collapseText: 'show less',
        onExpand: (bool, e) => console.log(bool, e),
      }}
      style={{ width: 300 }}
    >
      不让你收起来略：Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph
      copyable
      ellipsis={{
        rows: 3,
        expandable: true,
        collapsible: true,
        onExpand: (bool, e) => console.log(bool, e),
      }}
      style={{ width: 300 }}
    >
      又可以复制啦：Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph
      link
      ellipsis={{
        rows: 3,
        expandable: true,
        collapsible: true,
        onExpand: (bool, e) => console.log(bool, e),
      }}
      style={{ width: 300 }}
    >
      又来测试链接啦啦啦：Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
  </div>
);

EllipsisCollapsible.story = {
  name: 'Ellipsis collapsible?',
};

export const EllipsisFromCenter = () => (
  <div>
    <Paragraph
      ellipsis={{
        rows: 3,
        pos: 'middle',
        expandable: true,
        collapsible: true,
        onExpand: (bool, e) => console.log(bool, e),
      }}
      style={{ width: 300 }}
    >
      多行中间截断还能展开和折叠：Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ rows: 3, pos: 'middle', showTooltip: true }} style={{ width: 300 }}>
      多行中间截断不能展开和折叠：多行中间截断不能展开和折叠：多行中间截断不能展开和折叠：多行中间截断不能展开和折叠：多行中间截断不能展开和折叠：多行中间截断不能展开和折叠：多行中间截断不能展开和折叠：多行中间截断不能展开和折叠：多行中间截断不能展开和折叠：
    </Paragraph>
    <br />
    <Paragraph
      ellipsis={{
        pos: 'middle',
        expandable: true,
        collapsible: true,
        onExpand: (bool, e) => console.log(bool, e),
      }}
      style={{ width: 300 }}
    >
      单行中间截断还能展开和折叠： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ pos: 'middle', expandable: true }} style={{ width: 300 }}>
      单行中间截断还能展开超厉害： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ pos: 'middle' }} style={{ width: '50%' }}>
      单行中间截断： Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph ellipsis={{ rows: 3, pos: 'middle', expandable: true }} style={{ width: '50%' }}>
      自动适配的多行中间截断：Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Title heading={3} ellipsis={{ pos: 'middle' }} style={{ width: '50%' }}>
      我是一个酷炫的从中间折断的3号标题
    </Title>
    <br />
    <Text
        data-cy="nowrap-middile-ellipsis1"
        ellipsis={{ pos: 'middle', rows: 1, showTooltip: true }}
        style={{ width: '200px', whiteSpace: 'nowrap', overflow: 'hidden' }}
    >
      不能换行的单行从中间截断时，应该能正常展示省略
    </Text>
    <br />
    <Text
        data-cy="nowrap-middile-ellipsis2"
        ellipsis={{ pos: 'middle', rows: 1, showTooltip: true }}
        style={{ width: '200px', overflow: 'hidden' }}
    >
      This/one/does/not/wrap/like/the/one/before/but/does/not/have/whiteSpace/set
    </Text>
    <br />
    <Text ellipsis={{ pos: 'middle' }} style={{ width: '50%' }}>
      通常のテキストでさえ、切り捨てる機能が必要です
    </Text>
    <br />
    <br />
    <Text link ellipsis={{ pos: 'middle' }} style={{ width: '50%' }}>
      Even ordinary text wants to have the ability to truncate from center
    </Text>
  </div>
);

EllipsisFromCenter.story = {
  name: 'Ellipsis from center',
};

export const Copyable = () => (
  <div>
    <Paragraph copyable>
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。 区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
    </Paragraph>
    <br />
    <Paragraph copyable={{
      onCopy: (e, content) => {
        console.log(content);
      }
    }} >点击右边的图标复制文本。</Paragraph>
    <br />
    <Paragraph spacing="extended" copyable>
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。
      <br />
      区别于其他的设计系统而言，Semi Design
      以用户中心、内容优先、设计人性化为设计理念，具有以下优势：
      <br />
      -Semi Design
      以内容优先进行设计，这使得我们更容易搭建基于内容操作（多媒体、视频、音频等）的业务组件。
      <br />
      -更容易地自定义主题。面向公司众多不同的产品业务线，我们能够更快速地自定义具有该产品品牌风格的主题。
      <br />
      -适用国际化场景。组件设计时重视国际化场景，其中设计语言已应用在海外审核、运营等场景。
      <br />
      -效率场景加入人性化关怀。我们坚信追求高效的同时也要加入人性化的关怀，形成正向循环，追求长期的收益。➡️
    </Paragraph>
    <br />
    <Paragraph spacing="extended" copyable>
      <span>
        Semi Design 是由抖音前端团队与 UED
        团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
        Web 应用。 ➡️
      </span>
    </Paragraph>
    <Paragraph 
      spacing="extended" 
      copyable={{
        successTip: 'success'
      }}
    >测试 renderCopyNode 属性</Paragraph>
    <Paragraph 
      spacing="extended" 
      copyable={{
        icon: <IconSetting style={{ color: 'var(--semi-color-link)' }}/>
      }}
    >测试 renderCopyNode 属性</Paragraph>
  </div>
);

export const CopyableWarning = () => (
  <>
    <Paragraph 
        spacing="extended" 
        copyable
      >这里有一个非text节点，控制台<strong>应该</strong>报 warning</Paragraph> 
      <Paragraph 
        spacing="extended" 
        copyable={{
          content: '复制结果是我'
        }}
      >这里有一个非text节点但是设置了copyable的 content（类型为 string），所以控制台对这条<strong>不应该</strong>报 warning</Paragraph>
  </>
)

export const ContainerResize = () => (
  // from https://github.com/DouyinFE/semi-design/pull/1514
  // 用于 E2E 测试中容器尺寸 resize， 动态省略
  <>
    {/* css 截断 */}
    <Typography.Text ellipsis={{ showTooltip: true, rows: 2 }}>
      这是第一个test：有省略的文本，resize到省略消失，再resize回原来的尺寸，没有省略状态
      这是第一个test：有省略的文本，resize到省略消失，再resize回原来的尺寸，没有省略状态
      这是第一个test：有省略的文本，resize到省略消失，再resize回原来的尺寸，没有省略状态
      这是第一个test：有省略的文本，resize到省略消失，再resize回原来的尺寸，没有省略状态
    </Typography.Text>
    <br />
    {/* js 截断 */}
    <Typography.Text
      ellipsis={{ showTooltip: true, rows: 2, expandable: true }}
    >
      这是第二个test：可展开的文本，在折叠状态下，resize到展开消失，再resize回原来的尺寸，变成了展开状态;
      这是第二个test：可展开的文本，在折叠状态下，resize到展开消失，再resize回原来的尺寸，变成了展开状态;
      这是第二个test：可展开的文本，在折叠状态下，resize到展开消失，再resize回原来的尺寸，变成了展开状态;
    </Typography.Text>
    <br />
  </>
);

export const EdgeCases = () => (
  <>
    <p>Case 1: pos: 'middle', 无content，测试是否触发 TypeError</p>
    <Text 
      ellipsis={{  rows: 3,  pos: 'middle',  expandable: true, }} 
      style={{ width: 300 }}
    ></Text>
    <br />
    <p>Case 2: css 截断, 无 content，测试是否触发 TypeError</p>
    <Text 
      ellipsis={{ rows: 1 }} 
      style={{ width: 300 }}
    ></Text>
    <br />
    <Paragraph 
      ellipsis={{ 
        pos: 'middle', 
        rows: 3, 
        expandable: true, 
        collapsible: true, 
        collapseText: '折叠我吧' 
      }} 
      style={{ width: 300 }}>
        case 3：长度刚好符合预期，不应该省略，不应该显示展开按钮。长度刚好符合预期，不应该省略，不应该显示展开按钮。不应该显示展开的。
    </Paragraph>
  </>
);

export const showTooltip = () => (
  <>
    <Text 
      ellipsis={{  showTooltip: true, rows: 3 }} 
      style={{ width: 300 }}
    > css 截断，本内容超出长度限制，需要截断，因为设置了ellipsis中 showTooltip 为 true，所以通过 hover 可以展示全部内容，鼠标移入触发hover效果下试试
    </Text>
    <br />
    <Text 
      ellipsis={{  showTooltip: true, rows: 3, pos: 'middle' }} 
      style={{ width: 300 }}
    > pos 为 middle，无 expanded /suffix 相关设置，js 截断，本内容超出长度限制，需要截断，因为设置了ellipsis中 showTooltip 为 true，所以通过 hover 可以展示全部内容，鼠标移入触发hover效果下试试
    </Text> 
  </>
);

export const childrenTypeNumber = () => {
  // 如果 Text 的 children 为 number 类型，组件不应该出错
  const { Text } = Typography;
  const name = 123123;
  return (
      <div>
          <Text 
            ellipsis={{ showTooltip: true, pos: 'middle'}}
            style={{ maxWidth: 120, width: '100%'}}>{name}
          </Text>
      </div>
  );
}

export const TextInline = () => {
  const { Text } = Typography;
  return (
    <div>
      <div style={{ width: 500 }}>
        <Text 
          ellipsis={{ showTooltip: true }}
          style={{ width: 300 }}
        >
          这是一个 Text，使用 css 截断，保持 Text 的 inline 属性，所以这行应该可以其他元素出现在一行
        </Text>
        <span style={{ fontSize: 12, lineHeight: '16px', backgroundColor: 'green' }}>这行</span>
      </div>
      <br />
      <div style={{ width: 500 }}>
        <Text 
          ellipsis={{ showTooltip: true, rows: 2, pos: 'middle' }}
          style={{ width: 300 }}
        >
          这是一个 Text，使用 js 截断，保持 Text 的 inline 属性，所以这行应该可以其他元素出现在一行
        </Text>
        <span style={{ fontSize: 12, lineHeight: '16px', backgroundColor: 'green' }}>这行</span>
      </div>
    </div>
  )
}

export const whiteSpaceNoWrap = () => (
  <div style={{ whiteSpace: 'nowrap' }}>
    <Typography.Text
      copyable
      style={{ width: 100 }}
      ellipsis={{
        showTooltip: true,
      }}
    >
      需要截断这段文字，[此处不可见]
    </Typography.Text>
  </div>
)

export const TextNoWarning = () => {
  const { Text } = Typography;
  return (
    <div>
      <div style={{ width: 500 }}>
        <Text 
          style={{ width: 300 }}
        >
          <div>这是一个非 string 类型的 Text 的 children, 无省略功能，控制台不应该出现和省略相关的 warning</div>
        </Text>
      </div>
    </div>
  )
}

export const JsEllipsisNoTooltip = () => (
  <Title 
    heading={5} 
    ellipsis={{ showTooltip: true, suffix: ' ' }} 
    // wordBreak 设置在 Title 的style里
    style={{ width: 250, wordBreak: 'break-all' }}
  >
      data_tns
  </Title>
)

export const HugeDataDemo = () => {
    return <HugeData/>
}

export const CustomTooltip = () => {
  const customRenderTooltip = useCallback((content, children) => {
    return <Tooltip content={content} style={{ backgroundColor: 'var(--semi-color-primary)' }}>{children}</Tooltip>
  }, []);

  return <div>
     <Title 
      heading={5} 
      ellipsis={{ 
        showTooltip: {
          renderTooltip: customRenderTooltip
        }
      }} 
      style={{ width: 250 }}
      
    >
      这是一个自定义 tooltip 的省略文本，背景色是蓝色
    </Title>
  </div>
}

export const GlobalEllipsisPopoverCls = () => (
  <Title 
    heading={5} 
    ellipsis={{ 
      showTooltip: {
        type: 'popover',
        opts: {
          className: 'testPopoverCls'
        }
      },
    }} 
    // wordBreak 设置在 Title 的style里
    style={{ width: 250, wordBreak: 'break-all' }}
  >
    测试 showTooltip 中的 type 为 popover 时，传入的类名称正确
  </Title>
)

export const SingleRowCssEllipsisAccurate = () => {
  const { Text } = Typography;
  return (
    <div>
      <p>文本截断，hover 展示 tooltip 正常</p>
      <Text
        style={{ width: 171 }}
        ellipsis={{
          showTooltip: true,
        }}
      >
        Latin America-巴西-圣保罗
      </Text>
    </div>
  );
}

export const InheritSize = () => {
  const { Text } = Typography;
  return (
    <Text size="small">这是一段文本，样式为 small
      <Text link size="inherit">这是一段链接，设置 size 为 inherit 继承外部样式设置</Text>
    </Text>
  )
}

export const SizeAffectIcon = () => {
  // 增加用例，观察 size 设置对 icon 大小的影响
  return (
      <>
          <Text size="normal"  icon={<IconLink />} underline>带下划线的网页链接</Text> 
          <br />   
          <br />     
          <Text size="small"  icon={<IconLink />} underline>带下划线的网页链接</Text>
      </>
  )
}

export const StrongEllipsis = () =>{
    return (
      // 用于测试 strong 类型的 ellipsis 效果是否符合预期
      // https://github.com/DouyinFE/semi-design/pull/2506
      <div className="App">
        <Typography.Title heading={2}>windows</Typography.Title>
        {/* case 1 */}
        <Typography.Paragraph
          strong
          ellipsis={{ rows: 3, suffix: "HELLO WORLD" }}
          style={{ width: 300 }}
        >
          这是一个多行截断的例子：Semi Design 是由抖音前端团队与 UED
          团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
          Web 应用。
        </Typography.Paragraph>
        <br />
        {/* case 2 */}
        <Typography.Paragraph
          strong
          ellipsis={{ rows: 3, suffix: "HELLO WORLD" }}
          style={{ width: 300, wordBreak: "break-all" }}
        >
          这是一个多行截断的例子：Semi Design 是由抖音前端团队与 UED
          团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
          Web 应用。
        </Typography.Paragraph>
        <Typography.Title heading={2}>macOS</Typography.Title>
        {/* case 3 */}
        <Typography.Paragraph
          strong
          ellipsis={{ rows: 3, suffix: "1234567891011" }}
          style={{ width: 300 }}
        >
          这是一个多行截断的例子：Semi Design 是由抖音前端团队与 UED
          团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
          Web 应用。
        </Typography.Paragraph>
        <br />
        {/* case 4 */}
        <Typography.Paragraph
          strong
          ellipsis={{ rows: 3, suffix: "123456" }}
          style={{ width: 300, wordBreak: "break-all" }}
        >
          这是一个多行截断的例子：Semi Design 是由抖音前端团队与 UED
          团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
          Web 应用。
        </Typography.Paragraph>
      </div>
    );
}