/* argus-disable unPkgSensitiveInfo */
import React from 'react';
import { storiesOf } from '@storybook/react';
// import { withKnobs, text, boolean } from '@storybook/addon-knobs';

import Icon from '../../icons';
import Typography from '../index';

const stories = storiesOf('Typography', module);
const { Title, Text, Paragraph } = Typography;

stories.add('Title', () => (
    <div>
        <Title>h1. Semi Design</Title>
        <Title heading={2}>h2. Semi Design</Title>
        <Title heading={3}>h3. Semi Design</Title>
        <Title heading={4}>h4. Semi Design</Title>
        <Title heading={5}>h5. Semi Design</Title>
        <Title heading={6}>h6. Semi Design</Title>
        <Title heading={6} link>h6. Semi Design</Title>
    </div>
));

stories.add('Text', () => (
    <div>
        <Text draggable={false} onClick={()=>console.log('cc')}>Text</Text>
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
        <Text link weight={700}><Icon type="link" />网页链接</Text>
    </div>
));

stories.add('Text icon', () => (
    <div>
        <Text icon='link'>Text</Text>
        <br />
        <Text icon='link' type="secondary">Secondary</Text>
        <br />
        <Text icon='link' type="warning">Warning</Text>
        <br />
        <Text icon='link' type="danger">Dange</Text>
        <br />
        <Text icon='link' disabled>Disabled</Text>
        <br />
        <Text icon='link' mark>Default Mark</Text>
        <br />
        <Text icon='link' code>Example Code</Text>
        <br />
        <Text icon='link' underline>Underline</Text>
        <br />
        <Text icon='link' delete>Deleted</Text>
        <br />
        <Text icon='link' strong>Strong</Text>
        <br />
        <Text icon='link' link>链接文本</Text>
        <br />
        <Text icon='link' link={{ href: 'https://semi.design/' }}>打开网站</Text>
        <br />
        {/* <Text link><Icon type="link" />网页链接</Text> */}
    </div>
));

stories.add('Paragraph', () => (
    <div>
        <Paragraph>
            Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            <br/>
            区别于其他的设计系统而言，Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有以下优势：
            <br/>
            -Semi Design 以内容优先进行设计，这使得我们更容易搭建基于内容操作（多媒体、视频、音频等）的业务组件。
            <br/>
            -更容易地自定义主题。面向公司众多不同的产品业务线，我们能够更快速地自定义具有该产品品牌风格的主题。
            <br/>
            -适用国际化场景。组件设计时重视国际化场景，其中设计语言已应用在海外审核、运营等场景。
            <br/>
            -效率场景加入人性化关怀。我们坚信追求高效的同时也要加入人性化的关怀，形成正向循环，追求长期的收益。
        </Paragraph>
        <br />
        <Paragraph spacing="extended">
            Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            <br/>
            区别于其他的设计系统而言，Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有以下优势：
            <br/>
            -Semi Design 以内容优先进行设计，这使得我们更容易搭建基于内容操作（多媒体、视频、音频等）的业务组件。
            <br/>
            -更容易地自定义主题。面向公司众多不同的产品业务线，我们能够更快速地自定义具有该产品品牌风格的主题。
            <br/>
            -适用国际化场景。组件设计时重视国际化场景，其中设计语言已应用在海外审核、运营等场景。
            <br/>
            -效率场景加入人性化关怀。我们坚信追求高效的同时也要加入人性化的关怀，形成正向循环，追求长期的收益。
        </Paragraph>
    </div>
));

// expandable and custom ellipsis string not supported yet
stories.add('Ellipsis', () => (
    <div>
        <Paragraph ellipsis style={{width: 250}}>
        Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
区别于其他的设计系统而言，Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
        </Paragraph>
        <br />
        <Paragraph ellipsis={{rows: 3}} style={{width: 300}}>
        Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
区别于其他的设计系统而言，Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
        </Paragraph>
        <br />
        <Paragraph ellipsis={{rows: 3}} style={{width: 300}}>
        Inspired by Ant Design Typography. 更多细节：https://bytedance.feishu.cn/docs/doccnqovjjyoKm2U5O13bj30aTh
        </Paragraph>
        <br />
        <Paragraph ellipsis={{rows: 3, expandable: true}} style={{width: 250}}>
        Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
区别于其他的设计系统而言，Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
        </Paragraph>
        <br />
        <Paragraph ellipsis={{expandable: true}} style={{width: 250}}>
        Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
区别于其他的设计系统而言，Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
        </Paragraph>
    </div>
));

stories.add('Copyable', () => (
    <div>
        <Paragraph copyable>
        Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
区别于其他的设计系统而言，Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有四大优势。
        </Paragraph>
        <br />
        <Paragraph copyable>
        点击右边的图标复制文本。
        </Paragraph>
        <br />
        <Paragraph spacing="extended" copyable>
            Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            <br/>
            区别于其他的设计系统而言，Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有以下优势：
            <br/>
            -Semi Design 以内容优先进行设计，这使得我们更容易搭建基于内容操作（多媒体、视频、音频等）的业务组件。
            <br/>
            -更容易地自定义主题。面向公司众多不同的产品业务线，我们能够更快速地自定义具有该产品品牌风格的主题。
            <br/>
            -适用国际化场景。组件设计时重视国际化场景，其中设计语言已应用在海外审核、运营等场景。
            <br/>
            -效率场景加入人性化关怀。我们坚信追求高效的同时也要加入人性化的关怀，形成正向循环，追求长期的收益。➡️
        </Paragraph>
        <br />
        <Paragraph spacing="extended" copyable>
            <span>Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的 Web 应用。
            ➡️</span>
        </Paragraph>
    </div>
));