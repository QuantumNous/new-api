import React from 'react';
import { storiesOf } from '@storybook/react';
import { Layout } from '../index';

const stories = storiesOf('Layout', module);

stories.add('Layout', () => (
    <Layout className='components-layout-demo'>
        <Layout.Header>Header</Layout.Header>
        <Layout.Content>Content</Layout.Content>
        <Layout.Footer>Footer</Layout.Footer>
    </Layout>
));