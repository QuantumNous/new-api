import * as React from 'react';
import { PageHeader, Button, Layout } from '@arco-design/web-react';

export function LayoutWrap(props: any) {
  return (
    <Layout style={{ height: '100%' }}>
      <PageHeader
        style={{ background: 'var(--color-bg-2)', borderBottom: '1px solid #eee' }}
        title="VMind Playground"
        subTitle="every word, every story"
      />
      {props.children}
    </Layout>
  );
}
