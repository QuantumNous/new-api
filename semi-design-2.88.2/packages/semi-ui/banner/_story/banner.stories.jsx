import React, { useState } from 'react';

import Banner from '../index';
import Button from '@douyinfe/semi-ui/button/index';
import { Layout } from '@douyinfe/semi-ui';


export default {
  title: 'Banner',
}


export const Default = () => (
  <>
    <Banner description="A pre-released version is available" />
    <br />
    <Banner
      onClick={e => console.log('clicking banner!!!!', e.target)}
      onClose={e => {
        e.stopPropagation();
      }}
      description="A pre-released version is available A pre-released version is availableA pre-released version is availableA pre-released version is availableA pre-released version is availableA pre-released version is availableA pre-released version is available"
    >
      <Button onClick={e => e.stopPropagation()}>test</Button>
    </Banner>
  </>
);

export const InContainer = () => (
  <Banner
    onClick={e => console.log('clicking banner!!!!', e.target)}
    onClose={e => {
      e.stopPropagation();
    }}
    fullMode={false}
    title="标题"
    description="A pre-released version is available"
  >
    <Button onClick={e => e.stopPropagation()}>test</Button>
  </Banner>
);

export const InContainerAndBordered = () => (
  <Banner title="标题" bordered description="A pre-released version is available">
    <Button onClick={e => e.stopPropagation()}>test</Button>
  </Banner>
);

export const ShowAndHideBanner = () => {
    const [visible, setVisible] = useState(false);
    const changeVisible = () => {
        setVisible(!visible);
    };
    const { Header, Footer, Content } = Layout;
    const banner = (
        <Banner 
            onClose={changeVisible}
            description="A pre-released version is available"
        />
    );

    return (
        <>
            <Layout>
                <Header>Header</Header>
                {visible? banner : null}
                <Content>Content</Content>
                <Footer>Footer</Footer>
            </Layout>
            <Button
                onClick={changeVisible}
                style={{
                    display: 'block',
                    width: '120px',
                    margin: '0 auto'
                }}
            >
                { visible ? 'Hide Banner' : 'Show Banner' }
            </Button>
        </>
    );
};

export const MultiTypeBanner = () => (
    <>
        <Banner 
            type="info"
            description="A pre-released version is available."
        />
        <br/>
        <Banner 
            type="warning"
            description="This version of the document is going to expire after 4 days."
        />
        <br/>
        <Banner 
            type="danger"
            description="This document was deprecated since Jan 1, 2019."
        />
        <br/>
        <Banner 
            type="success"
            description="You are viewing the latest version of this document."
        />
    </>
);