import React, { useState, useCallback } from 'react';
import { storiesOf } from '@storybook/react';
import { RadioGroup, Radio } from '@douyinfe/semi-ui';
import { defaultMessages } from './message';
import { AIChatDialogue } from '../../index';
import { AIChatDialogueProps } from '../interface';

const roleConfig = {
  user:  {
      name: 'User',
      avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png'
  },
  assistant: {
      name: 'Assistant',
      avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
  },
  system: {
      name: 'System',
      avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png'
  }
}

const stories = storiesOf('AIChatDialogue', module);


stories.add('align and mode', () => {
  const [messages, setMessage] = useState(defaultMessages);
  const [mode, setMode] = useState<AIChatDialogueProps['mode']>('bubble');
  const [align, setAlign] = useState<AIChatDialogueProps['align']>('leftRight');

  const onAlignChange = useCallback((e) => {
      setAlign(e.target.value);
  }, []);

  const onModeChange = useCallback((e) => {
      setMode(e.target.value);
  }, []); 

  const onChatsChange = useCallback((chats) => {
      setMessage(chats);
  }, []);

  return (
      <>
          <span style={{ display: 'flex', flexDirection: 'column', rowGap: '8px'}}>
              <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                  模式
                  <RadioGroup onChange={onModeChange} value={mode} type={"button"}>
                      <Radio value={'bubble'}>气泡</Radio>
                      <Radio value={'noBubble'}>非气泡</Radio>
                      <Radio value={'userBubble'}>用户会话气泡</Radio>
                  </RadioGroup>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                  会话布局方式
                  <RadioGroup onChange={onAlignChange} value={align} type={"button"}>
                      <Radio value={'leftRight'}>左右分布</Radio>
                      <Radio value={'leftAlign'}>左对齐</Radio>
                  </RadioGroup>
              </span>
          </span>
          <AIChatDialogue 
              key={align + mode}
              align={align}
              mode={mode}
              chats={messages}
              roleConfig={roleConfig}
              onChatsChange={onChatsChange}
          />
      </>
  );
});

