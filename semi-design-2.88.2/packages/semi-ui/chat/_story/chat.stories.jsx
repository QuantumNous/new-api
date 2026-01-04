import { getUuidv4 } from '@douyinfe/semi-foundation/utils/uuid';
import Chat from '../index';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Form, Button, Avatar, Dropdown, Radio, RadioGroup, Switch, Collapsible, AvatarGroup, Divider } from '@douyinfe/semi-ui';
import { IconUpload, IconForward, IconMoreStroked, IconArrowRight, IconChevronUp } from '@douyinfe/semi-icons';
import MarkdownRender from '../../markdownRender';
import { initMessage, roleInfo, commonOuterStyle, hintsExample, infoWithAttachment, simpleInitMessage, semiCode, infoWithDivider, infoWithJSX, tableContent } from './constant';

export default {
    title: 'Chat',
    parameters: {
      chromatic: { disableSnapshot: true },
    }
}

const uploadProps = { action: 'https://api.semi.design/upload' }

export const _Chat = () => {
    const [message, setMessage] = useState(initMessage);
    const [hints, setHints] = useState(hintsExample);
    const [mode, setMode] = useState('bubble');
    const [align, setAlign] = useState('leftRight');
    const [sendHotKey, setSendHotKey] = useState('enter');
    const [key, setKey] = useState(1);
    const [showClearContext, setShowClearContext] = useState(false);

    const onClear = useCallback((clearMessage) => {
       console.log('onClear');
    }, []);

    const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getUuidv4(),
            content: "这是一条 mock 回复信息",
        }
        setMessage((message) => {
            return [
                ...message,
                newAssistantMessage
            ]
        })
    }, []);

    const onMessageDelete = useCallback((message) => {
       console.log('message delete', message);
    }, []);

    const onChatsChange = useCallback((chats) => {
        console.log('onChatsChange', chats);
        setMessage(chats);
    }, []);

    const onMessageGoodFeedback = useCallback((message) => {
        console.log('message good feedback', message);
    }, []);

    const onMessageBadFeedback = useCallback((message) => {
        console.log('message bad feedback', message);
    }, []);

    const onMessageReset = useCallback((message) => {
        console.log('message reset', message);
    }, []);

    const onInputChange = useCallback((props) => {
        console.log('onInputChange', props);
    }, []);

    const onHintClick = useCallback((hint) => {
        setHints([]);
    }, []);

    const onModeChange = useCallback((e) => {
        setMode(e.target.value);
        setKey((key) => key + 1);
    }, []); 

    const onAlignChange = useCallback((e) => {
        setAlign(e.target.value);
        setKey((key) => key + 1);
    }, []);

    const onSwitchChange = useCallback(() => {
        setShowClearContext((showClearContext) => !showClearContext);
    }, [])

    const onSendHotKeyChange = useCallback((e) => {
        setSendHotKey(e.target.value);
    }, []);

    return (
        <>
            <div style={{margin: 10, display: 'flex', flexDirection: 'column', rowGap: 5}}>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                    展示清除上下文按钮：
                    <Switch checked={showClearContext} onChange={onSwitchChange}/>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                    模式：
                    <RadioGroup onChange={onModeChange} value={mode} type="button">
                        <Radio value={'bubble'}>气泡</Radio>
                        <Radio value={'noBubble'}>非气泡</Radio>
                        <Radio value={'userBubble'}>用户会话气泡</Radio>
                    </RadioGroup>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                    布局：
                    <RadioGroup onChange={onAlignChange} value={align} type="button">
                        <Radio value={'leftRight'}>左右分布</Radio>
                        <Radio value={'leftAlign'}>全左</Radio>
                    </RadioGroup>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', columnGap: '10px'}}>
                    按键发送策略：
                    <RadioGroup onChange={onSendHotKeyChange} value={sendHotKey} type="button">
                        <Radio value={'enter'}>enter</Radio>
                        <Radio value={'shift+enter'}>shift+enter</Radio>
                    </RadioGroup>
                </span>
            </div>
            <div style={{ height: 650}}>
                <Chat
                    key={key}
                    style={commonOuterStyle}
                    chats={message}
                    hints={hints}
                    roleConfig={roleInfo}
                    onClear={onClear}
                    onMessageSend={onMessageSend}
                    onMessageDelete={onMessageDelete}
                    onMessageGoodFeedback={onMessageGoodFeedback}
                    onMessageBadFeedback={onMessageBadFeedback}
                    onChatsChange={onChatsChange}
                    onMessageReset={onMessageReset}
                    onInputChange={onInputChange}
                    onHintClick={onHintClick}
                    uploadProps={uploadProps}
                    uploadTipProps={{
                        content: '自定义输入提示'
                    }}
                    mode={mode} 
                    align={align}
                    sendHotKey={sendHotKey} 
                    showClearContext={showClearContext}
                />
            </div>
        </>
    )
}


export const TableContent = () => {
    const [message, setMessage] = useState(tableContent);

    return (
        <div
            style={{ height: 600, width: 400}}
        >
            <Chat 
                placeholder={'不处理输入信息，仅用于展示'}
                style={commonOuterStyle}
                chats={message}
                roleConfig={roleInfo}
                uploadProps={uploadProps}
            />
        </div>
    )
}

export const Attachment = () => {
    const [message, setMessage] = useState(infoWithAttachment);

    return (
        <div
            style={{ height: 600}}
        >
            <Chat 
                placeholder={'不处理输入信息，仅用于展示附件'}
                style={commonOuterStyle}
                chats={message}
                roleConfig={roleInfo}
                uploadProps={uploadProps}
            />
        </div>
    )
}

function CustomInputRender(props) {
    const { defaultNode, onClear, onSend } = props;
    const api = useRef();
    const onSubmit = useCallback(() => {
        if (api.current) {
            const values = api.current.getValues();
            if ((values.name && values.name.length !== 0) || (values.file && values.file.length !== 0)) {
                onSend(values.name, values.file);
                api.current.reset();
            } 
        }
    }, []);

    return (<div style={{   
        display: 'flex', 
        flexDirection: 'column', 
        border: '1px solid var(--semi-color-border)',
        margin: '8px 16px',
        borderRadius: 8,
        padding: 8
    }}>
        <Form
            getFormApi={formApi => api.current = formApi}
        >
            <strong>输入信息</strong>
            <Form.Input
                field="name"
                label="名称（Input）"
                style={{ width: 250 }}
                trigger='blur'
            />
            <Form.Upload
                field='file'
                label='文档'
                action='https://api.semi.design/upload'
            >
                <Button icon={<IconUpload />} theme="light">
                    点击上传
                </Button>
            </Form.Upload>
        </Form>
        <Button style={{ width: 'fit-content' }} onClick={onSubmit}>提交</Button>
    </div>);
}

export const CustomRenderInputArea = () => {
    const [message, setMessage] = useState(initMessage.slice(0, 1));

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const onMessageSend = useCallback((content, attachment) => {
        const newUserMessage = {
            role: 'user',
            id: getUuidv4(),
            content: content,
            attachment: attachment
        }
        const newAssistantMessage = {
            role: 'assistant',
            id: getUuidv4(),
            content: `This is a mock response`
        }
        setMessage((message) => ([...message, newUserMessage, newAssistantMessage]));
    }, []);

    const renderInputArea = useCallback((props) => {
        return (<CustomInputRender {...props} />)
    }, []);     

    return (
        <div
            style={{ height: 600}}
        >
            <Chat 
                style={commonOuterStyle}
                chats={message}
                roleConfig={roleInfo}
                onChatsChange={onChatsChange}
                onMessageSend={onMessageSend}
                renderInputArea={renderInputArea}
                uploadProps={uploadProps}
            />
        </div>
    )
}

function CustomInputRender2(props) {
    const { defaultNode, onClear, onSend, detailProps } = props;
    const { clearContextNode, uploadNode, inputNode, sendNode, onClick } = detailProps;
   
    return <div style={{margin: '8px 16px', display: 'flex', flexDirection:'row',
      alignItems: 'flex-end', borderRadius: 16,padding: 10, border: '1px solid var(--semi-color-border)'}}
      onClick={onClick} 
    >
        {uploadNode}
        {inputNode}
        {sendNode}
    </div>
}

export const CustomRenderInputArea2 = () => {
    const [message, setMessage] = useState(initMessage.slice(0, 1));

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getUuidv4(),
            content: `This is a mock response`
        }
        setMessage((message) => ([...message, newAssistantMessage]));
    }, []);

    const renderInputArea = useCallback((props) => {
        return (<CustomInputRender2 {...props} />)
    }, []);     

    return (
        <div
            style={{ height: 600}}
        >
            <Chat 
                style={commonOuterStyle}
                chats={message}
                roleConfig={roleInfo}
                onChatsChange={onChatsChange}
                onMessageSend={onMessageSend}
                renderInputArea={renderInputArea}
                uploadProps={uploadProps}
            />
        </div>
    )
}

export const CustomRenderAvatar = (props) => {
    const customRenderAvatar = useCallback((props)=> {
        const { role, defaultAvatar } = props;
        return <Avatar size="extra-small" shape="square" style={{ flexShrink: '0'}}>{role.name}</Avatar >
    }, []);

    const customRenderTitle =  useCallback((props)=> null, []);

    return (<div
        style={{ height: 600 }}
    >
        <Chat 
            style={commonOuterStyle}
            chats={initMessage.slice(0, 4)}
            roleConfig={roleInfo}
            chatBoxRenderConfig={{
                renderChatBoxTitle: customRenderTitle,
                renderChatBoxAvatar: customRenderAvatar
            }}
            uploadProps={uploadProps}
        />
    </div>);
}

export const CustomRenderTitle = (props) => {
    const customRenderTitle = useCallback((props) => {
        const { role, message, defaultTitle } = props;
        if (message.role === 'user') {
            return null;
        }
        return <span style={{ display:' flex', alignItems: 'center', justifyContent: 'center', columnGap: '10px'}}>
            <Avatar size="extra-small" shape="square" src={role.avatar} />
            {defaultTitle}
        </span>
    }, []);

    const customRenderAvatar = useCallback((props)=> null, []);

    return (<div
        style={{ height: 600}}
    >
        <Chat
            placeholder={"不处理输入信息，仅用于展示自定义头像和标题"}
            style={commonOuterStyle}
            chats={simpleInitMessage}
            roleConfig={roleInfo}
            chatBoxRenderConfig={{
                renderChatBoxTitle: customRenderTitle,
                renderChatBoxAvatar: customRenderAvatar
            }}
            uploadProps={uploadProps}
        />
    </div>);
}

export const CustomFullChatBox = () => {
    const customRenderChatBox = useCallback((props) => {
        const { role, message, defaultNodes, className } = props;
        const date = new Date(message.createAt);
        const year = date.getFullYear();
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const day = ('0' + date.getDate()).slice(-2);
        const hours = ('0' + date.getHours()).slice(-2);
        const minutes = ('0' + date.getMinutes()).slice(-2);
        const seconds = ('0' + date.getSeconds()).slice(-2);
        const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        return <div className={className}>
            <div style={{ display: 'flex', flexDirection: 'column', rowGap: 5, alignItems: message.role === 'user' ? 'end' : ''}}>
                <span style={{color: 'var(--semi-color-text-2', fontSize: '12px'}}>{formattedDate}</span>
                <div style={{ width: 'fit-content'}}>
                    {defaultNodes.content}
                </div>
                {defaultNodes.action}
            </div>
        </div>
    }, []);

    return (<div
        style={{ height: 600}}
    >
        <Chat
            style={commonOuterStyle} 
            chats={simpleInitMessage}
            roleConfig={roleInfo}
            chatBoxRenderConfig={{
                renderFullChatBox: customRenderChatBox
            }}
            uploadProps={uploadProps}
        />
    </div>);
}

const CustomActions = React.memo((props) => {
    const { role, message, defaultActions, className } = props;
    const myRef = useRef();
    const getContainer = useCallback(() => {
        if (myRef.current) {
            const element = myRef.current;
            let parentElement = element.parentElement;
            while (parentElement) {
                if (parentElement.classList.contains('semi-chat-chatBox-wrap')) {
                    return parentElement;
                }
                parentElement = parentElement.parentElement;
            }
        }
    }, [myRef]);
    return <span 
        className={className}
        ref={myRef}
    >
        {defaultActions.map((item, index)=> {
            return <span key={index}>{item}</span>
        })}
        {<Dropdown
            key="dropdown"
            render={
                <Dropdown.Menu >
                    <Dropdown.Item icon={<IconForward />}>分享</Dropdown.Item>
                </Dropdown.Menu>
            }
            trigger="click"
            position="top"
            getPopupContainer={getContainer}
        >
            <Button 
                className='semi-chat-chatBox-action-btn'
                icon={<IconMoreStroked/>}
                theme='borderless'
                type='tertiary'
            />
        </Dropdown>}
    </span>
});

export const CustomRenderAction = () => {
    const [message, setMessage] = useState(simpleInitMessage);
    const customRenderAction = useCallback((props) => {
        return <CustomActions {...props} />
    }, []);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    return (<div
        style={{ height: 600}}
    >
        <Chat 
            chats={message}
            onChatsChange={onChatsChange}
            style={commonOuterStyle}
            roleConfig={roleInfo}
            chatBoxRenderConfig={{
                renderChatBoxAction: customRenderAction
            }}
            uploadProps={uploadProps}
        />
    </div>);
}

export const CustomRenderContent = () => {
    const renderContent = useCallback((props) => {
        const { role, message, defaultNode, className } = props;
        return <div className={className}>
            <span>---custom render content---</span>
            <MarkdownRender raw={message?.content}/>
        </div>
    }, []);

    return (<div
        style={{ height: 600}}
    >
        <Chat 
            style={commonOuterStyle}
            chats={simpleInitMessage}
            roleConfig={roleInfo}
            chatBoxRenderConfig={{
                renderChatBoxContent: renderContent
            }}
            uploadProps={uploadProps}
        />
    </div>);
}

// const Card = (source) => {
//     return (<span className="demo-card">
//         <span className="demo-card-title"></span>
//         <span className="demo-card-link"></span>
//         <span className="demo-card-content"></span>
//     </span>)
// }

const SourceCard = (props) => {
    const [open, setOpen] = useState(true);
    const [show, setShow] = useState(false);
    const spanRef = useRef();
    const onOpen = useCallback(() => {
        setOpen(false);
        setShow(true);
    }, []);

    const onClose = useCallback(() => {
        setOpen(true);
        setTimeout(() => {
            setShow(false);
        }, 350)
    }, []);

    return (<div style={{ 
            transition: open ? 'height 0.4s ease, width 0.4s ease': 'height 0.4s ease',
            height: open ? '30px' : '184px',
            width: open ? '237px': '100%', 
            background: 'var(--semi-color-tertiary-light-hover)', 
            borderRadius: 16,
            boxSizing: 'border-box',
        }}
        >
        <span
            ref={spanRef} 
            style={{
                display: !open ? 'none' : 'flex',
                width: 'fit-content',
                columnGap: 10,
                background: 'var(--semi-color-tertiary-light-hover)', 
                borderRadius: '16px',
                padding: '5px 10px',
                point: 'cursor',
                fontSize: 14,
                color: 'var(--semi-color-text-1)',
            }}
            onClick={onOpen} 
        >
            <span>基于{props.sources.length}个搜索来源</span>
            <AvatarGroup size="extra-extra-small" >
                {props.sources.map((s, index) => (<Avatar key={index} src={s.avatar}></Avatar>))}        
            </AvatarGroup>
        </span>
        <span 
            style={{
                height: '100%',
                boxSizing: 'border-box',
                display: !open ? 'flex' : 'none',
                flexDirection: 'column',
                background: 'var(--semi-color-tertiary-light-hover)', borderRadius: '16px', padding: 12, boxSize: 'border-box'
            }}
            onClick={onClose}
            >
            <span style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '5px 10px', columnGap: 10, color: 'var(--semi-color-text-1)'
            }}>
                <span style={{fontSize: 14, fontWeight: 500}}>Source</span>
                <IconChevronUp />
            </span>
            <span style={{display: 'flex', flexWrap: 'wrap', gap: 10,  overflow: 'scroll', padding: '5px 10px'}}>
                {props.sources.map(s => (
                    <span style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        rowGap: 5, 
                        flexBasis: 150, 
                        flexGrow: 1,
                        border: "1px solid var(--semi-color-border)",
                        borderRadius: 12,
                        padding: 12,
                        fontSize: 12
                    }}>
                        <span style={{display: 'flex', columnGap: 5, alignItems: 'center', }}>
                            <Avatar style={{width: 16, height: 16, flexShrink: 0 }} shape="square" src={s.avatar} />
                            <span style={{ color: 'var(--semi-color-text-2)', textOverflow: 'ellipsis'}}>{s.title}</span>
                        </span>
                        <span style={{
                            color: 'var(--semi-color-primary)',
                            fontSize: 12,
                        }}
                        >{s.subTitle}</span>
                        <span style={{
                            display: '-webkit-box',
                            "-webkit-box-orient": 'vertical',
                            WebkitLineClamp: '3', 
                            textOverflow: 'ellipsis', 
                            overflow: 'hidden',
                            color: 'var(--semi-color-text-2)',
                        }}>{s.content}</span>
                    </span>))}
                </span>
            </span>
        </div>
    )
}


export const CustomRenderContentPlus = () => {
    const chat = [
        {
        role: 'assistant',
        id: '3',
        createAt: 1715676751919,
        content: "Semi Design 是由抖音前端团队，MED 产品设计团队设计、开发并维护的设计系统。它作为全面、易用、优质的现代应用 UI 解决方案，从字节跳动各业务线的复杂场景提炼而来，支撑近千计平台产品，服务内外部 10 万+ 用户。",
        source: [
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/zh-CN/start/introduction',
                title: 'semi Design',
                subTitle: 'Semi design website',
                content: 'Semi Design 是由抖音前端团队，MED 产品设计团队设计、开发并维护的设计系统。'
            },
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/dsm/landing',
                subTitle: 'Semi DSM website',
                title: 'Semi 设计系统',
                content: '从 Semi Design，到 Any Design 快速定义你的设计系统，并应用在设计稿和代码中'
            },
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/code/zh-CN/start/introduction',
                subTitle: 'Semi D2C website',
                title: '设计稿转代码',
                content: 'Semi 设计稿转代码（Semi Design to Code，或简称 Semi D2C），是由抖音前端 Semi Design 团队推出的全新的提效工具'
            },
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/zh-CN/start/introduction',
                title: 'semi Design',
                subTitle: 'Semi design website',
                content: 'Semi Design 是由抖音前端团队，MED 产品设计团队设计、开发并维护的设计系统。'
            },
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/dsm/landing',
                subTitle: 'Semi DSM website',
                title: 'Semi 设计系统',
                content: '从 Semi Design，到 Any Design 快速定义你的设计系统，并应用在设计稿和代码中'
            },
            {
                avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/other/logo.png',
                url: '/code/zh-CN/start/introduction',
                subTitle: 'Semi D2C website',
                title: '设计稿转代码',
                content: 'Semi 设计稿转代码（Semi Design to Code，或简称 Semi D2C），是由抖音前端 Semi Design 团队推出的全新的提效工具'
            },
        ]
    }];

    const renderContent = useCallback((props) => {
        const { role, message, defaultNode, className } = props;
        return <div className={className}>
            <SourceCard sources={message?.source} />
            <MarkdownRender raw={message?.content}/>
        </div>
    }, []);

    return (<div
        style={{ height: 600}}
    >
        <Chat 
            style={commonOuterStyle}
            chats={chat}
            roleConfig={roleInfo}
            chatBoxRenderConfig={{
                renderChatBoxContent: renderContent
            }}
            uploadProps={uploadProps}
        />
        <div></div>
    </div>);
}

export const LeftAlign =  () => {
    return (<div
        style={{ height: 600}}
    >
        <Chat
            style={commonOuterStyle} 
            chats={simpleInitMessage}
            roleConfig={roleInfo}
            align='leftAlign'
            uploadProps={uploadProps}
        />
    </div>);
}

export const MessageStatus = () => {
    const messages = [
        initMessage[1],
        {
            ...initMessage[2],
            content: '请求错误',
            status: 'error'
        },
        {
            id: 'loading',
            role: 'assistant',
            status: 'loading'
        },
    ]
    return (<div
        style={{ height: 600}}
    >
        <Chat
            style={commonOuterStyle} 
            chats={messages}
            roleConfig={roleInfo}
            uploadProps={uploadProps}
        />
    </div>);
}

export const MockResponseMessage = () => {
    const [message, setMessage] = useState([ initMessage[0]]);
    const intervalId = useRef();

    const onChatsChange = useCallback((chats) => {
        console.log('onChatsChange', chats);
        setMessage(chats);
    }, []);

    const onMessageSend = useCallback((content, attachment) => {
        setMessage((message) => {
            return [
                ...message,
                {
                    role: 'user',
                    createAt: Date.now(),
                    id: getUuidv4(),
                    content: content,
                    attachment: attachment,
                },
                {
                    role: 'assistant',
                    status: 'loading',
                    createAt: Date.now(),
                    id: getUuidv4()
                }
            ]
        }); 
        generateMockResponse(content);
    },[])

    const generateMockResponse = useCallback((content) => {
        const id = setInterval(() => {
            setMessage((message) => {
                const lastMessage = message[message.length - 1];
                let newMessage = {};
                if (lastMessage.status === 'loading') {
                    newMessage =  {
                        role: 'assistant',
                        id: getUuidv4(),
                        content:  `mock Response for ${content} \n`,
                        status: 'incomplete'
                    }
                } else if (lastMessage.status === 'incomplete') {
                    if (lastMessage.content.length > 200) {
                        clearInterval(id);
                        intervalId.current = null
                        newMessage = {
                            role: 'assistant',
                            id: getUuidv4(),
                            content: `${lastMessage.content} mock stream message`,
                            status: 'complete'
                        }
                    } else {
                        newMessage =  {
                            role: 'assistant',
                            id: getUuidv4(),
                            content: `${lastMessage.content} mock stream message`,
                            status: 'incomplete'
                        }
                    }  
                }
                return [
                    ...message.slice(0, -1),
                    newMessage
                ]
            })
        }, 400);
        intervalId.current = id;
    }, []);

    const onStopGenerator = useCallback(() => {
        if (intervalId.current) {
            clearInterval(intervalId.current);
            setMessage((message) => {
                const lastMessage = message[message.length - 1];
                if (lastMessage.status && lastMessage.status !== 'complete') {
                    const lastMessage = message[message.length - 1];
                    let newMessage = {...lastMessage};
                    newMessage.status = 'complete';
                    return [
                        ...message.slice(0, -1),
                        newMessage
                    ]
                } else {
                    return message;
                }
            })
        }
    }, [intervalId]);

    return (
    <div
        style={{ height: 300}}
    >
        <Chat 
            style={commonOuterStyle}
            chats={message}
            roleConfig={roleInfo}
            onChatsChange={onChatsChange}
            onMessageSend={onMessageSend}
            onStopGenerator={onStopGenerator}
            showStopGenerate={true}
            uploadProps={uploadProps}
        />
    </div>
    );
}

export const CustomRenderHint = () => {
    const [message, setMessage] = useState(initMessage.slice(0, 3));
    const [hint, setHint] = useState(hintsExample);

    const commonHintStyle = useMemo(() => ({
        border: '1px solid var(--semi-color-border)',
        padding: '10px',
        borderRadius: '10px',
        width: 'fit-content',
        color: 'var( --semi-color-text-1)',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        fontSize: '14px'
    }), []);
    
    const renderHintBox = useCallback((props) => {
        const { content, onHintClick, index } = props;
        return <div style={commonHintStyle} onClick={onHintClick} key={index}>
            {content}
            <IconArrowRight style={{ marginLeft: 10 }}>click me</IconArrowRight>
        </div>
    }, []);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);

    const onHintClick = useCallback((hint) => {
        setHint([]);
    }, []);

    const onClear = useCallback(() => {
        setHint([]);
    }, []);

    return <div
        style={{ height: 600}}
    >
        <Chat 
            style={commonOuterStyle}
            chats={message}
            onChatsChange={onChatsChange}
            onHintClick={onHintClick}
            hints={hint}
            roleConfig={roleInfo}
            renderHintBox={renderHintBox}
            onClear={onClear}
            uploadProps={uploadProps}
        />
    </div>
}

export const CustomRenderDivider = () => {
    const [message, setMessage] = useState(infoWithDivider);

    const renderDivider = useCallback((message) => (
        <Divider key={message.id} >
            <span style={{fontSize: '14px', lineHeight: '14px', fontWeight: 400, margin: '0 8px'}}>以下为新消息</span>
        </Divider>
    ), []);

    return (
        <div style={{ height: 600 }}>
            <Chat 
                placeholder={'不处理输入信息，仅用于展示附件'}
                style={commonOuterStyle}
                chats={message}
                roleConfig={roleInfo}
                uploadProps={uploadProps}
                renderDivider={renderDivider}
            />
        </div>
    );
}

export const MarkdownRenderProps = () => {
    const [message, setMessage] = useState(infoWithJSX);
    const components = {};
    components['MyButton'] = ({ children,onClick }) => {
        return <Button type={"primary"} onClick={onClick} style={{marginBottom:"12px"}}> {children} </Button>
    }
    const markdownRenderProps = {
        format: 'mdx',
        components: {...MarkdownRender.defaultComponents,...components}
    }

    return (
        <div
            style={{ height: 600}}
        >
            <Chat 
                placeholder={'不处理输入信息，仅用于展示附件'}
                style={commonOuterStyle}
                chats={message}
                roleConfig={roleInfo}
                uploadProps={uploadProps}
                markdownRenderProps={markdownRenderProps}
            />
        </div>
    )
}

export const EnableUpload = () => {
    const [message, setMessage] = useState(simpleInitMessage);
    const [allowUpload, setAllowUpload] = useState('allowAll');

    const onClear = useCallback((clearMessage) => {
       console.log('onClear');
    }, []);

    const onMessageSend = useCallback((content, attachment) => {
        const newAssistantMessage = {
            role: 'assistant',
            id: getUuidv4(),
            content: "这是一条 mock 回复信息",
        }
        setMessage((message) => {
            return [
                ...message,
                newAssistantMessage
            ]
        })
    }, []);

    const onMessageDelete = useCallback((message) => {
       console.log('message delete', message);
    }, []);

    const onChatsChange = useCallback((chats) => {
        console.log('onChatsChange', chats);
        setMessage(chats);
    }, []);

    const onMessageGoodFeedback = useCallback((message) => {
        console.log('message good feedback', message);
    }, []);

    const onMessageBadFeedback = useCallback((message) => {
        console.log('message bad feedback', message);
    }, []);

    const onMessageReset = useCallback((message) => {
        console.log('message reset', message);
    }, []);

    const onInputChange = useCallback((props) => {
        console.log('onInputChange', props);
    }, []);

    const onUploadChange = useCallback((e) => {
        setAllowUpload(e.target.value)
    }, []);

    const getUploadProps = useCallback((allowUpload) => {
        switch(allowUpload) {
            case 'allowAll':
                return true;
            case 'disallowAll':
                return false;
            case 'disablePaste':
                return { pasteUpload: false }
            case 'disableDrag':
                return { dragUpload: false }
            case 'disableClick':
                return { clickUpload: false}
            default:
                return true;
        }
    }, [])

    return (
        <>
            <RadioGroup onChange={onUploadChange} value={allowUpload}>
                <Radio value={'allowAll'} checked={allowUpload} >允许上传</Radio>
                <Radio value={'disallowAll'} checked={!allowUpload} >不允许上传</Radio>
                <Radio value={'disablePaste'} checked={!allowUpload} >不允许粘贴上传</Radio>
                <Radio value={'disableDrag'} checked={!allowUpload} >不允许拖拽上传</Radio>
                <Radio value={'disableClick'} checked={!allowUpload} >不允许点击上传</Radio>
            </RadioGroup>
            <br/><br/>
            <div style={{ height: 450}}>
                <Chat
                    style={commonOuterStyle}
                    chats={message}
                    roleConfig={roleInfo}
                    onClear={onClear}
                    onMessageSend={onMessageSend}
                    onMessageDelete={onMessageDelete}
                    onMessageGoodFeedback={onMessageGoodFeedback}
                    onMessageBadFeedback={onMessageBadFeedback}
                    onChatsChange={onChatsChange}
                    onMessageReset={onMessageReset}
                    onInputChange={onInputChange}
                    enableUpload={getUploadProps(allowUpload)}
                />
            </div>
        </>
    )
}