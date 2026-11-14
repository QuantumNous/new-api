import React, { useState } from 'react';
import { Layout } from '@arco-design/web-react';
import { LeftInput } from './LeftInput';
import { RightChart } from './RightChart';
const Sider = Layout.Sider;
const Content = Layout.Content;

export function Home() {
  const [spec, setSpec] = useState<any>(undefined);
  const [openAIKey, setOpenAIKey] = useState<string | undefined>(undefined);
  document.body.setAttribute('arco-theme', 'dark');
  const [time, setTime] = useState<{
    totalTime: number;
    frameArr: any[];
  }>();
  return (
    <Layout>
      <Sider
        resizeDirections={['right']}
        style={{
          height: '100%',
          minWidth: 400
        }}
      >
        <LeftInput
          onSpecGenerate={(spec, time) => {
            setSpec(spec);
            setTime(time);
          }}
          openAIKey={openAIKey}
          setOpenAIKey={setOpenAIKey}
        />
      </Sider>
      <Content>
        <RightChart openAIKey={openAIKey} spec={spec} time={time} />
      </Content>
    </Layout>
  );
}
