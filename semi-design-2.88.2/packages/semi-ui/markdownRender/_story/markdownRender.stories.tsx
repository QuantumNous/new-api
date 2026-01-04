import React from 'react';
import { storiesOf } from '@storybook/react';
import MarkdownRender from '@douyinfe/semi-ui/markdownRender';


const stories = storiesOf('MarkdownRender', module);

stories.add('Markdown 渲染器', () => <MarkdownRender mdxRaw={"# test"} />);
