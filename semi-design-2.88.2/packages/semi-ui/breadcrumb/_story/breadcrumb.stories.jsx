/* argus-disable unPkgSensitiveInfo */
import React from 'react';
import Breadcrumb from '../index';
import Popover from '../../popover';
import {
  IconMore,
  IconArrowRight,
  IconHome,
  IconArticle,
  IconChevronRight,
} from '@douyinfe/semi-icons';

export default {
  title: 'Breadcrumb',
}

export const Default = () => (
  <div>
    <Breadcrumb
      routes={[
        {
          path: '/home',
          name: 'home',
        },
        'breadcrumb',
        'default',
      ]}
      aria-label='example-1'
      onClick={item => console.log(item)}
    />
    <Breadcrumb
      aria-label='example-2'
      routes={[
        {
          path: '/home',
          icon: <IconHome />,
          href: '#',
        },
        {
          path: '/breadcrumb',
          name: 'breadcrumb',
          icon: <IconChevronRight />,
        },
        'icon',
      ]}
      onClick={item => console.log(item)}
    />
    <Breadcrumb
      aria-label='example-3'
      routes={[
        {
          path: '/home',
          name: 'home',
        },
        'breadcrumb',
        'separator',
        'string',
      ]}
      onClick={item => console.log(item)}
      separator={'>'}
    />
    <Breadcrumb
      aria-label='example-4'
      routes={[
        {
          path: '/home',
          name: 'home',
        },
        'breadcrumb',
        'separator',
        'with icon',
      ]}
      onClick={item => console.log(item)}
      separator={<IconArrowRight size={'small'} />}
    />
    <Breadcrumb
      aria-label='example-5'
      routes={['首页', '当这个页面标题很长时需要省略', '详情页']}
      onClick={item => console.log(item)}
    />
    <Breadcrumb
      aria-label='example-6'
      routes={[
        '首页',
        '当层级很多的时候',
        '又一层很长需要省略的时候',
        '再一层',
        '上上一层',
        '上一层',
        '详情页',
      ]}
      onClick={item => console.log(item)}
    />
  </div>
);

export const Compact = () => (
  <div>
    <Breadcrumb
      aria-label='example-1'
      routes={[
        {
          path: '/home',
          name: 'home',
        },
        'breadcrumb',
        'compact',
      ]}
      onClick={item => console.log(item)}
      compact={true}
    />
    <Breadcrumb
      aria-label='example-2'
      routes={[
        {
          path: '/home',
          icon: <IconHome />,
        },
        {
          path: '/breadcrumb',
          name: 'breadcrumb',
          icon: <IconChevronRight />,
        },
        'icon',
      ]}
      onClick={item => console.log(item)}
      compact={true}
    />
    <Breadcrumb
      aria-label='example-3'
      routes={[
        {
          path: '/home',
          name: 'home',
        },
        'breadcrumb',
        'separator',
        'string',
      ]}
      onClick={item => console.log(item)}
      separator={'>'}
      compact={true}
    />
    <Breadcrumb
      aria-label='example-4'
      routes={[
        {
          path: '/home',
          name: 'home',
        },
        'breadcrumb',
        'separator',
        'icon',
      ]}
      onClick={item => console.log(item)}
      separator={<IconArrowRight size={'small'} />}
      compact={true}
    />
    <Breadcrumb
      aria-label='example-5'
      routes={['首页', '当这个页面标题很长时需要省略', '详情页']}
      onClick={item => console.log(item)}
      compact={true}
    />
    <Breadcrumb
      aria-label='example-6'
      routes={[
        '首页',
        '当层级很多的时候',
        '又一层很长需要省略的时候',
        '再一层',
        '上上一层',
        '上一层',
        '详情页',
      ]}
      onClick={item => console.log(item)}
      compact={true}
    />
  </div>
);

export const BreadcrumbItemJSX = () => (
  <div>
    <Breadcrumb aria-label='example-1' onClick={item => console.log(item)}>
      <Breadcrumb.Item onClick={item => console.log('child', item)}>home</Breadcrumb.Item>
      <Breadcrumb.Item href="#">breadcrumb</Breadcrumb.Item>
      <Breadcrumb.Item>default</Breadcrumb.Item>
    </Breadcrumb>
    <Breadcrumb aria-label='example-2' onClick={item => console.log(item)}>
      <Breadcrumb.Item icon={<IconHome />}></Breadcrumb.Item>
      <Breadcrumb.Item>breadcrumb</Breadcrumb.Item>
      <Breadcrumb.Item>default</Breadcrumb.Item>
    </Breadcrumb>
    <Breadcrumb aria-label='example-3' separator={'>'} onClick={item => console.log(item)}>
      <Breadcrumb.Item>home</Breadcrumb.Item>
      <Breadcrumb.Item href="#">breadcrumb</Breadcrumb.Item>
      <Breadcrumb.Item>separator</Breadcrumb.Item>
    </Breadcrumb>
    <Breadcrumb aria-label='example-4' compact={true} onClick={item => console.log(item)}>
      <Breadcrumb.Item>home</Breadcrumb.Item>
      <Breadcrumb.Item>breadcrumb</Breadcrumb.Item>
      <Breadcrumb.Item>compact</Breadcrumb.Item>
    </Breadcrumb>
    <Breadcrumb aria-label='example-5' onClick={item => console.log(item)}>
      <Breadcrumb.Item>首页</Breadcrumb.Item>
      <Breadcrumb.Item>当这个页面标题很长时需要省略</Breadcrumb.Item>
      <Breadcrumb.Item>详情页</Breadcrumb.Item>
    </Breadcrumb>
    <Breadcrumb aria-label='example-6' onClick={item => console.log(item)}>
      <Breadcrumb.Item>首页</Breadcrumb.Item>
      <Breadcrumb.Item>当层级很多的时候</Breadcrumb.Item>
      <Breadcrumb.Item>又一层很长需要省略的时候</Breadcrumb.Item>
      <Breadcrumb.Item>再一层</Breadcrumb.Item>
      <Breadcrumb.Item>上上一层</Breadcrumb.Item>
      <Breadcrumb.Item>上一层</Breadcrumb.Item>
      <Breadcrumb.Item>详情页</Breadcrumb.Item>
    </Breadcrumb>
    <Breadcrumb></Breadcrumb>
  </div>
);

export const Test = () => (
  <div>
    <Breadcrumb aria-label='example-1' onClick={item => console.log(item)}>
      <Breadcrumb.Item onClick={item => console.log('child', item)}>home jump</Breadcrumb.Item>
      <Breadcrumb.Item href="#">breadcrumb</Breadcrumb.Item>
      <Breadcrumb.Item>
        <h1>default</h1>
      </Breadcrumb.Item>
    </Breadcrumb>
    <Breadcrumb aria-label='example-2'>
      <Breadcrumb.Item icon={<IconHome />}></Breadcrumb.Item>
      <Breadcrumb.Item icon={<IconArticle />}>
        <h5>breadcrumb</h5>
      </Breadcrumb.Item>
      <Breadcrumb.Item>with icon</Breadcrumb.Item>
    </Breadcrumb>
  </div>
);

const separator = '-'; // 用于拼接 restItem 数组项的分隔符

const renderMore = restItem => {
  const content = (
    <>
      {restItem.map((item, idx) => (
        <React.Fragment key={`restItem-${idx}`}>
          {item}
          {idx !== restItem.length - 1 && (
            <span
              style={{
                color: 'var(--semi-color-text-2)',
                marginRight: '6px',
              }}
            >
              {separator}
            </span>
          )}
        </React.Fragment>
      ))}
    </>
  );
  return (
    <Popover
      content={content}
      style={{
        padding: 12,
      }}
      showArrow
    >
      <IconMore />
    </Popover>
  );
};

export const RenderMore = () => (
  <div
    style={{
      margin: '100px',
    }}
  >
    <Breadcrumb
      aria-label='example-1'
      renderMore={restItem => renderMore(restItem)}
      onClick={(item, e) => console.log(item, e)}
    >
      <Breadcrumb.Item>首页</Breadcrumb.Item>
      <Breadcrumb.Item>当层级很多的时候</Breadcrumb.Item>
      <Breadcrumb.Item>又一层</Breadcrumb.Item>
      <Breadcrumb.Item>再一层</Breadcrumb.Item>
      <Breadcrumb.Item>上上一层</Breadcrumb.Item>
      <Breadcrumb.Item>上一层</Breadcrumb.Item>
      <Breadcrumb.Item>详情页</Breadcrumb.Item>
    </Breadcrumb>
    <br />
    <br />
    <div>
      <Breadcrumb
        aria-label='example-2'
        renderMore={restItem => renderMore(restItem)}
        onClick={(item, e) => console.log(item, e)}
        routes={[
          {
            path: '/',
            href: '/',
            icon: <IconHome />,
          },
          {
            path: '/breadcrumb',
            href: '/components/breadcrumb',
            name: 'breadcrumb',
            icon: <IconArticle />,
          },
          {
            path: '/breadcrumb',
            href: '/components/breadcrumb',
            name: 'breadcrumb',
            icon: <IconArticle />,
          },
          {
            path: '/breadcrumb',
            href: '/components/breadcrumb',
            name: 'breadcrumb',
            icon: <IconArticle />,
          },
          'with icon',
        ]}
      />
    </div>
  </div>
);

export const MaxItemCountAndMoreType = () => (
  // 用于测试 moreType 为 popover, maxItemCount 自定义情况下，
  // item 个数超出时候是否可弹出, 弹出层中内容是否正确
  <Breadcrumb maxItemCount={2} moreType={'popover'}>
    <Breadcrumb.Item>第一层</Breadcrumb.Item>
    <Breadcrumb.Item>第二层</Breadcrumb.Item>
    <Breadcrumb.Item>第二层</Breadcrumb.Item>
    <Breadcrumb.Item>第四层</Breadcrumb.Item>
  </Breadcrumb>
);

export const NoLink = () => (
  <Breadcrumb>
    <Breadcrumb.Item icon={<IconHome size="small" />} noLink >Test</Breadcrumb.Item>
    <Breadcrumb.Item icon={<IconArticle size="small" />}>Breadcrumb</Breadcrumb.Item>
    <Breadcrumb.Item>With Icon</Breadcrumb.Item>
  </Breadcrumb>
)
