import React, { useState } from 'react';
import Button from '../../button';
import { Anchor } from '../../index';

export default {
  title: 'Anchor',
}

const getContainer = () => {
  const node = document.getElementById('box');
  return node;
};

const Link = Anchor.Link;

export const Size = () => (
  <div>
    <div>小号尺寸</div>
    <Anchor aria-label='小号尺寸' size={'small'}>
      <Link href="#welcome" title="welcome" />
      <Link href="#api" title="api too much to show" />
      <Link href="#contact" title="contact" />
    </Anchor>
    <br />
    <div>默认</div>
    <Anchor>
      <Link href="#welcome" title="welcome" />
      <Link href="#api" title="api too much to show" />
      <Link href="#contact" title="contact" />
    </Anchor>
  </div>
);

export const Theme = () => (
  <div>
    <div>点击锚点查看效果</div>
    <br />
    <Anchor railTheme={'primary'}>
      <Link href="#组件" title="组件" />
      <Link href="#设计语言" title="设计语言" />
      <Link href="#物料平台" title="物料平台" />
      <Link href="#主题商店" title="主题商店" />
    </Anchor>
    <br />
    <Anchor railTheme={'tertiary'}>
      <Link href="#组件" title="组件" />
      <Link href="#设计语言" title="设计语言" />
      <Link href="#物料平台" title="物料平台" />
      <Link href="#主题商店" title="主题商店" />
    </Anchor>
    <br />
    <Anchor railTheme={'muted'}>
      <Link href="#组件" title="组件" />
      <Link href="#设计语言" title="设计语言" />
      <Link href="#物料平台" title="物料平台" />
      <Link href="#主题商店" title="主题商店" />
    </Anchor>
  </div>
);

export const autoCollapse = () => (
  <>
    <div>Anchor 设置 autoCollapse 可以动态展示下一级锚点。</div>
    <br />
    <div>点击 1.Semi Design 查看效果</div>
    <div id='collapse'>
      <Anchor autoCollapse={true}>
        <Link href="#Semi Design" title="1. Semi Design">
          <Link href="#组件" title="1.1 组件">
            <Link href="#头像" title="1.1.1 Avatar" />
            <Link href="#按钮" title="1.1.2 Button" />
            <Link href="#图标" title="1.1.3 Icon" />
          </Link>
          <Link href="#物料" title="1.2 物料" />
          <Link href="#主题商店" title="1.3 主题商店" />
        </Link>
        <Link href="#设计语言" title="2. 设计语言" />
      </Anchor>
    </div>
    <br />
    <div>默认不进行动态折叠</div>
    <div id='no-collapse'>
      <Anchor autoCollapse={false}>
        <Link href="#Semi Design" title="1. Semi Design">
          <Link href="#组件" title="1.1 组件">
            <Link href="#头像" title="1.1.1 Avatar" />
            <Link href="#按钮" title="1.1.2 Button" />
            <Link href="#图标" title="1.1.3 Icon" />
          </Link>
          <Link href="#物料" title="1.2 物料" />
          <Link href="#主题商店" title="1.3 主题商店" />
        </Link>
        <Link href="#设计语言" title="2. 设计语言" />
      </Anchor>
    </div>
  </>
);

export const showTooltip = () => (
  <div>
    <div>工具提示可以在 Link 超出最大宽度时显示 Link 的文字内容</div>
    <br />
    <Anchor showTooltip={true}>
      <Link href="#组件" title="组件" />
      <Link href="#设计语言" title="设计语言" />
      <Link href="#物料平台" title="物料平台" />
      <Link href="#主题商店" title="主题商店" />
      <Link
        href="#显示工具提示"
        title="工具提示是一个有用的工具，它可以在文字缩略时展示全部内容。"
      />
    </Anchor>
    <br />
    <div>position可以设置工具提示的位置</div>
    <Anchor showTooltip={true} position={'right'}>
      <Link href="#组件" title="组件" />
      <Link href="#设计语言" title="设计语言" />
      <Link href="#物料平台" title="物料平台" />
      <Link href="#主题商店" title="主题商店" />
      <Link
        href="#工具提示位置"
        title="工具提示是一个有用的工具，它可以在文字缩略时展示全部内容。"
      />
    </Anchor>
  </div>
);

export const MaxHeight = () => (
  <div>
    <div>设置 maxHeight 可以控制 Anchor 的高度，滚动显示 Anchor 内容</div>
    <br />
    <Anchor maxHeight={'100px'}>
      <Link href="#组件" title="组件" />
      <Link href="#设计语言" title="设计语言" />
      <Link href="#物料平台" title="物料平台" />
      <Link href="#主题商店" title="主题商店" />
      <Link
        href="#显示工具提示"
        title="工具提示是一个有用的工具，它可以在文字缩略时展示全部内容。"
      />
    </Anchor>
  </div>
);

export const StylePosition = () => (
  <div>
    <Anchor
      style={{ position: 'absolute', right: 0 }}
      scrollMotion={false}
      getContainer={getContainer}
    >
      <Link href="#welcome" title="welcome" />
      <Link href="#api" title="api too much to show">
        <Link href="#docs" title="docs">
          <Link href="#doc1" title="doc1" />
          <Link href="#doc2" title="doc2" />
        </Link>
      </Link>
      <Link href="#contact" title="contact" />
    </Anchor>

    <div>设置style对象可以改变 Anchor 组件的定位方式，右边就是个 fixed 的 Anchor</div>
    <div id="box" style={{ height: '500px', overflow: 'scroll' }}>
      <h1 id="welcome" style={{ height: '300px' }}>
        Welcome
      </h1>
      <h1 id="api" style={{ height: '300px' }}>
        API
      </h1>
      <h2 id="docs" style={{ height: '200px' }}>
        Docs
      </h2>
      <h3 id="doc1" style={{ height: '100px' }}>
        Doc1
      </h3>
      <h3 id="doc2" style={{ height: '100px' }}>
        Doc2
      </h3>
      <h1 id="contact" style={{ height: '300px' }}>
        Contact me
      </h1>
    </div>
  </div>
);

export const TargetOffset = () => (
  <div>
    <Anchor
      style={{ position: 'absolute', right: 0, top: 100 }}
      targetOffset={100}
      scrollMotion={true}
      getContainer={getContainer}
    >
      <Link href="#welcome" title="welcome" />
      <Link href="#api" title="api too much to show">
        <Link href="#docs" title="docs">
          <Link href="#doc1" title="doc1" />
          <Link href="#doc2" title="doc2" />
        </Link>
      </Link>
      <Link href="#contact" title="contact" />
    </Anchor>

    <div id="box" style={{ height: '500px', overflow: 'scroll', border: '1px solid #eee' }}>
      <div style={{ position: 'fixed', border: '1px solid red', height: 100, width: '100%' }}>
        这是 fixed 的一段话
      </div>
      <h1 style={{ height: '300px' }}>whatever</h1>
      <h1 id="welcome" style={{ height: '300px' }}>
        Welcome
      </h1>
      <h1 id="api" style={{ height: '300px' }}>
        API
      </h1>
      <h2 id="docs" style={{ height: '200px' }}>
        Docs
      </h2>
      <h3 id="doc1" style={{ height: '100px' }}>
        Doc1
      </h3>
      <h3 id="doc2" style={{ height: '100px' }}>
        Doc2
      </h3>
      <h1 id="contact" style={{ height: '300px' }}>
        Contact me
      </h1>
    </div>
  </div>
);

export const FixContainerScrollBug1158 = () => (
  <div style={{ height: '120vh' }}>
    <div style={{ width: 500, height: 500, position: 'relative', overflowY: 'scroll' }}>
      <Anchor
        style={{ position: 'absolute', right: 0 }}
        scrollMotion={true}
        getContainer={getContainer}
      >
        <Link href="#welcome" title="welcome" />
        <Link href="#api" title="api too much to show">
          <Link href="#docs" title="docs">
            <Link href="#doc1" title="doc1" />
            <Link href="#doc2" title="doc2" />
          </Link>
        </Link>
        <Link href="#contact" title="contact" />
      </Anchor>

      <div id="box" style={{ height: 700, overflowY: 'scroll' }}>
        <h1 id="welcome" style={{ height: '300px' }}>
          Welcome
        </h1>
        <h1 id="api" style={{ height: '300px' }}>
          API
        </h1>
        <h2 id="docs" style={{ height: '200px' }}>
          Docs
        </h2>
        <h3 id="doc1" style={{ height: '100px' }}>
          Doc1
        </h3>
        <h3 id="doc2" style={{ height: '100px' }}>
          Doc2
        </h3>
        <h1 id="contact" style={{ height: '300px' }}>
          Contact me
        </h1>
      </div>
    </div>
  </div>
);

export const AutoCollapse = () => {
  const [href, setHref] = useState('#设计语言');
  return (
      <div>
        <Anchor autoCollapse>
          <Anchor.Link href="#动态展示" title="1. 动态展示">
            <Anchor.Link href="#组件" title="1.1 组件">
                <Anchor.Link href="#头像" title="1.1.1 Avatar" />
                <Anchor.Link href="#按钮" title="1.1.2 Button" />
                <Anchor.Link href="#图标" title="1.1.3 Icon" />
            </Anchor.Link>
            <Anchor.Link href="#物料" title="1.2 物料" />
            <Anchor.Link href="#主题商店" title="1.3 主题商店" />
          </Anchor.Link>
          <Anchor.Link href={href} title="2. 设计语言" />
        </Anchor>
        <Button onClick={()=>{console.log('sdf');setHref('#我改变啦')}}>setHref</Button>
      </div>
  )
};

export const SetTooltip = () => {
  const getContainer = () => {
      return document.querySelector('window');
  };
  return (
      <div>
          <Anchor
              showTooltip={{
                type: 'popover',
                opts: {
                  style: { wordBreak: 'break-all' }
                }
              }}
              position={'right'}
              getContainer={getContainer}
              targetOffset={60}
              offsetTop={100}
          >
              <Anchor.Link href="#工具提示位置" title="基本示例111111111111111111111111111111111111111111111112" />
              <Anchor.Link href="#组件" title="组件" />
              <Anchor.Link href="#设计语言" title="设计语言" />
              <Anchor.Link href="#物料平台" title="物料平台" />
              <Anchor.Link href="#主题商店" title="主题商店" />
          </Anchor>
      </div>
  );
};