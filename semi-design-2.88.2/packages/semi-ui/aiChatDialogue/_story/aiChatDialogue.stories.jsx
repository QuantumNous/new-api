import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AIChatDialogue, RadioGroup, Radio, Button, Input, Toast, chatInputToChatCompletion, chatInputToMessage, AIChatInput } from '../../index';
import CustomRenderContentItem from './CustomRenderContentItem';
import RenderConfigContentItem from './RenderConfig';
import AIChatInputWithDialogueDemo from './AIChatInputWithDialogue';
import ResponseToMessageDemo from './DataAdapter/responseToMessage';
import StreamingChatCompletionToMessageDemo from './DataAdapter/streamingChatCompletionToMessage';
import StreamingResponseToMessageDemo from './DataAdapter/streamingResponseToMessage';
import ChatCompletionToMessageDemo from './DataAdapter/chatCompletionToMessage';
import MultiAssistant from './multiAssistant';
import { defaultMessages, loadingMessages, continueSendMessages, multiModalityMessage, reasoningMessage, toolCallMessage, annotationMessage, referenceMessage, failedMessage } from './message';
import MultiAgentDemo from './MultiAgent';
export default {
  title: 'AIChatDialogue',
}



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


export const AlignAndMode = () => {
  const [messages, setMessage] = useState(defaultMessages);
  const [mode, setMode] = useState('bubble');
  const [align, setAlign] = useState('leftRight');

  const onAlignChange = useCallback((e) => {
      setAlign(e.target.value);
  }, []);

  const onModeChange = useCallback((e) => {
      setMode(e.target.value);
  }, []); 

  const onChatsChange = useCallback((chats) => {
      setMessage(chats);
  }, []);

  const onReferenceClick = useCallback((item, message) => {
    console.log('onReferenceClick', item, message);
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
              onReferenceClick={onReferenceClick}
              // onMessageReset={onMessageReset}
          />
      </>
  );
}

export const Loading = () => {
  return (
    <AIChatDialogue 
      align="leftRight"
      mode="bubble"
      chats={loadingMessages}
      roleConfig={roleConfig}
    />
  )
}

export const Scroll = () => {

  return (
    <div style={{ height: '300px', border: '1px solid lightgray', padding: '10px', borderRadius: '10px' }}>
      <AIChatDialogue 
        align="leftRight"
        mode="bubble"
        chats={defaultMessages}
        roleConfig={roleConfig}
      />
    </div>
  )
}

export const continueSend = () => {
  const [selecting, setSelecting] = useState(false);

  const onSelect = useCallback((selectionId) => {
    console.log('onSelect', selectionId);
  }, []);

  return (
    <AIChatDialogue 
      align="leftRight"
      mode="bubble"
      chats={continueSendMessages}
      roleConfig={roleConfig}
      selecting={selecting}
      onSelect={onSelect}
      onMessageShare={() => {
        setSelecting(!selecting);
      }}
    />
  )
}

export const Action = () => {
  const [messages, setMessage] = useState(defaultMessages);
  const [selected, setSelected] = useState(false);
  const [editMessageId, setEditMessageId] = useState(null);

  const onChatsChange = useCallback((chats) => {
      setMessage(chats);
  }, []);

  const onSelect = useCallback((selectionId) => {
    console.log('onSelect', selectionId);
  }, []);

  const onCancel = useCallback(() => {
    const index = messages.findIndex(item => item.id === editMessageId);
    const newChat = {
        ...messages[index],
        isEditing: false,
    };
    const newChats = [...messages];
    newChats.splice(index, 1, newChat);
    setMessage(newChats);
  }, [editMessageId, messages]);

  // todo: 确认消息编辑交互形态
  const messageEditRender = (message) => {
    let value = message.content;

    const onChange = (curValue) => {
      value = curValue;
    }

    const onSubmit = () => {
      const index = messages.findIndex(item => item.id === editMessageId);
      const newChat = {
          ...messages[index],
          isEditing: false,
          content: value,
      };
      const newChats = [...messages];
      newChats.splice(index, 1, newChat);
      setMessage(newChats);
    };

    return (
      <div style={{ width: '100%', marginTop: '5px' }}>
        <Input defaultValue={value} onChange={onChange} />
        <div>
          <Button style={{ marginTop: '10px' }} type='primary' onClick={onSubmit}>保存</Button>
          <Button style={{ marginTop: '10px', marginLeft: '10px' }} type='primary' onClick={onCancel}>取消</Button>
        </div>
      </div>
    );
  }

  const onMessageEdit = useCallback((message) => {
    setEditMessageId(message.id);
    console.log('onMessageEdit', message);
  }, []);

  const onMessageReset = useCallback((e) => {
    setTimeout(() => {
        setMessage((message) => {
            const lastMessage = message[message.length - 1];
            const newLastMessage = {
                ...lastMessage,
                status: 'completed',
                content: 'This is a mock reset message.',
            }
            return [...message.slice(0, -1), newLastMessage]
        })
    }, 2000);
  })

  return (
    <AIChatDialogue 
      align="leftRight"
      mode="bubble"
      chats={messages}
      roleConfig={roleConfig}
      selecting={selected}
      onMessageCopy={(message) => {
        console.log('onMessageCopy', message);
      }}
      onMessageDelete={() => {
        console.log('onMessageDelete');
      }}
      onMessageReset={onMessageReset}
      onMessageGoodFeedback={(message) => {
        console.log('onMessageGoodFeedback', message.id);
      }}
      onMessageBadFeedback={() => {
        console.log('onMessageBadFeedback');
      }}
      onChatsChange={onChatsChange}
      onMessageShare={() => {
        console.log('onMessageShare', selected);
        setSelected(!selected);
      }}
      onMessageEdit={onMessageEdit}
      onSelect={onSelect}
      messageEditRender={messageEditRender}
    />
  )
}

export const Selecting = () => {
    const hintsExample = [
      "Semi 组件库有哪些常用组件？",
      "能否展示一个使用 Semi 组件库构建的页面示例？",
      "Semi 组件库有官方文档吗？",
    ]
    const ref = useRef(null);
    const [align, setAlign] = useState('leftRight');
    const [select, setSelect] = useState(true);
    const [selection, setSelection] = useState('allSelect');
    const [hints, setHints] = useState(hintsExample);

    useEffect(() => {
        ref.current.selectAll();
    }, []);

    const onAlignChange = useCallback((e) => {
        setAlign(e.target.value);
    }, []);

    const onSelectChange = useCallback((e) => {
        setSelect(e.target.value);
    }, []);

    const onSelectionChange = useCallback((e) => {
        if(e.target.value === 'allSelect') {
            ref.current.selectAll();
        } else {
            ref.current.deselectAll();
        }
        setSelection(e.target.value);
    }, []);

    const onSelect = useCallback((selectionId) => {
        console.log('onSelect', selectionId);
    }, []);

    const onHintClick = useCallback((hint) => {
      setHints([]);
  }, []);

    return (
        <div>
        <span style={{ display: 'flex', flexDirection: 'column', rowGap: '8px'}}>
            <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                会话布局方式
                <RadioGroup onChange={onAlignChange} value={align} type={"button"}>
                    <Radio value={'leftRight'}>左右分布</Radio>
                    <Radio value={'leftAlign'}>左对齐</Radio>
                </RadioGroup>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                是否开启选择
                <RadioGroup onChange={onSelectChange} value={select} type={"button"}>
                    <Radio value={true}>开启</Radio>
                    <Radio value={false}>关闭</Radio>
                </RadioGroup>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                选择方式
                <RadioGroup onChange={onSelectionChange} value={selection} type={"button"}>
                    <Radio value={'allSelect'}>全选</Radio>
                    <Radio value={'cancelSelect'}>取消全选</Radio>
                </RadioGroup>
            </span>
        </span>
        
        <AIChatDialogue 
            ref={ref}
            align={align}
            mode="bubble"
            chats={defaultMessages}
            selecting={select}
            onSelect={onSelect}
            roleConfig={roleConfig}
            hints={hints}
            onHintClick={onHintClick}
        />
      </div>
    )
}

export const Editing = () => {
    const [messages, setMessage] = useState(defaultMessages);
    const [editMessageId, setEditMessageId] = useState(null);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const onMessageEdit = useCallback((message) => {
        setEditMessageId(message.id);
        console.log('onMessageEdit', message);
    }, []);

    const onCancel = useCallback(() => {
      const index = messages.findIndex(item => item.id === editMessageId);
      const newChat = {
          ...messages[index],
          isEditing: false,
      };
      const newChats = [...messages];
      newChats.splice(index, 1, newChat);
      setMessage(newChats);
    }, [editMessageId, messages]);
  
    // todo: 确认消息编辑交互形态
    const messageEditRender = (message) => {
      let value = message.content;
  
      const onChange = (curValue) => {
        value = curValue;
      }
  
      const onSubmit = () => {
        const index = messages.findIndex(item => item.id === editMessageId);
        const newChat = {
            ...messages[index],
            isEditing: false,
            content: value,
        };
        const newChats = [...messages];
        newChats.splice(index, 1, newChat);
        setMessage(newChats);
      };
  
      return (
        <div style={{ width: '100%', marginTop: '5px' }}>
          <Input defaultValue={value} onChange={onChange} />
          <div style={{ display: 'flex', flexDirection: 'row-reverse', columnGap: '10px' }}>
            <Button style={{ marginTop: '10px' }} type='primary' onClick={onSubmit}>发送</Button>
            <Button style={{ marginTop: '10px', marginLeft: '10px' }} type='primary' onClick={onCancel}>取消</Button>
          </div>
        </div>
        // <Input defaultValue={value} onChange={onChange} />
      );
    }
  
    return (
      <AIChatDialogue 
          align="leftRight"
          mode="bubble"
          chats={messages}
          roleConfig={roleConfig}
          onChatsChange={onChatsChange}
          onMessageEdit={onMessageEdit}
          messageEditRender={messageEditRender}
      />
    )
}

export const MultiModality = () => {
    const [messages, setMessage] = useState(multiModalityMessage);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const onFileClick = useCallback((file) => {
        console.log('onFileClick', file);
    }, []);
  
    return (
      <AIChatDialogue 
        align="leftRight"
        mode="bubble"
        chats={messages}
        roleConfig={roleConfig}
        onChatsChange={onChatsChange}
        onFileClick={onFileClick}
        disabledFileClick={true}
      />
    )
}

export const Reasoning = () => {
    const [messages, setMessage] = useState(reasoningMessage);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);
  
    return (
      <AIChatDialogue 
        align="leftRight"
        mode="userBubble"
        chats={messages}
        roleConfig={roleConfig}
        onChatsChange={onChatsChange}
      />
    )
}

export const ToolCall = () => {
    const [messages, setMessage] = useState(toolCallMessage);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);
  
    return (
      <AIChatDialogue 
          align="leftRight"
          mode="bubble"
          chats={messages}
          roleConfig={roleConfig}
          onChatsChange={onChatsChange}
      />
    )
}

export const Annotation = () => {
    const [messages, setMessage] = useState(annotationMessage);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const onAnnotationClick = useCallback((annotation) => {
        console.log('onAnnotationClick', annotation);
        Toast.success('Ready to open the sidebar!');
    }, []);
  
    return (
      <AIChatDialogue 
          align="leftRight"
          mode="bubble"
          chats={messages}
          roleConfig={roleConfig}
          onChatsChange={onChatsChange}
          onAnnotationClick={onAnnotationClick}
      />
    )
}

export const ShowReference = () => {
  const onReferenceClick = useCallback((item) => {
    console.log('onReferenceClick', item);
  }, []);
  return (
    <AIChatDialogue 
      align="leftRight"
      mode="bubble"
      // mode="noBubble"
      chats={multiModalityMessage}
      roleConfig={roleConfig}
      showReference={true}
      onReferenceClick={onReferenceClick}
    />
  )
}

export const Reference = () => {
    const [messages, setMessage] = useState(referenceMessage);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);
  
    return (
      <AIChatDialogue 
          align="leftRight"
          mode="bubble"
          chats={messages}
          roleConfig={roleConfig}
          onChatsChange={onChatsChange}
      />
    )
}

export const CustomRender = CustomRenderContentItem;

export const RenderConfig = RenderConfigContentItem;

export const Failed = () => {
    const [messages, setMessage] = useState(failedMessage);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    return (
      <AIChatDialogue 
          align="leftRight"
          mode="bubble"
          chats={messages}
          roleConfig={roleConfig}
          onChatsChange={onChatsChange}
      />
    )
}

export const Hints = () => {
    const hintsExample = [
        "Semi 组件库有哪些常用组件？",
        "能否展示一个使用 Semi 组件库构建的页面示例？",
        "Semi 组件库有官方文档吗？",
    ]

    const [messages, setMessage] = useState(defaultMessages);
    const [hints, setHints] = useState(hintsExample);
  
    const onChatsChange = useCallback((chats) => {
        console.log('onChatsChange', chats);
        setMessage(chats);
    }, []);

    const onHintClick = useCallback((hint) => {
        setHints([]);
    }, []);

    return (
      <AIChatDialogue 
          align="leftRight"
          mode="bubble"
          chats={messages}
          roleConfig={roleConfig}
          onChatsChange={onChatsChange}
          hints={hints}
          onHintClick={onHintClick}
      />
    )
}

export const MultiAssistantStory = () => <MultiAssistant />;
MultiAssistantStory.storyName =  'Multi Assistant';

export const MultiAgentStory = () => <MultiAgentDemo />;
MultiAgentStory.storyName =  'Multi Agent';

export const AIChatInputWithDialogue = () => <AIChatInputWithDialogueDemo />;
AIChatInputWithDialogue.storyName =  'AIChatInput With Dialogue';

export const ResponseToMessageStory = () => <ResponseToMessageDemo />;
ResponseToMessageStory.storyName =  'adapter: response';

export const ChatCompletionToMessageStory = () => <ChatCompletionToMessageDemo />;
ChatCompletionToMessageStory.storyName =  'adapter: chatCompletion';

export const StreamingResponseToMessageStory = () => <StreamingResponseToMessageDemo />;
StreamingResponseToMessageStory.storyName =  'adapter: streaming response';

export const StreamingChatCompletionToMessageStory = () => <StreamingChatCompletionToMessageDemo />;
StreamingChatCompletionToMessageStory.storyName =  'adapter: streaming chatCompletion';

export const ChatInputToChatCompletionStory = () => {
  const [generating, setGenerating] = useState(false);
  const [messages, setMessages] = useState([]);

  const onContentChange = useCallback((content) => {
    // console.log('onContentChange', content);
  }, []);

  const onMessageSend = useCallback((props) => {
    // console.log('onMessageSend', props);
    const userMessage = chatInputToMessage(props);
    const chatCompletion = chatInputToChatCompletion(props);
    setGenerating(true);
    setMessages((messages) => [...messages, {
        id: `message-${Date.now()}`,
        ...userMessage
    }]);
    console.log('chatCompletion', chatCompletion);
    
  }, []);

  return (
    <AIChatInput 
      placeholder={'发送后查看控制台输出的结果'} 
      defaultContent={'帮我写一个关于<input-slot placeholder="[主题]">独角兽</input-slot>的故事'}
      skills={[]}
      generating={generating}
      uploadProps={{ action: "https://api.semi.design/upload" }}
      onContentChange={onContentChange}
      onMessageSend={onMessageSend}
      onStopGenerate={() => setGenerating(false)}
    />
  )
};
