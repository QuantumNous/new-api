import React, { useState, useCallback, useEffect } from 'react';
import { AIChatDialogue, streamingResponseToMessage } from '../../../index';
import { REASONING_CHUNKS } from '../Data/StreamingResponseData';

const defaultMessages = [{
    id: '1',
    role: 'user',
    content: '此处是用户的输入',
    status: 'completed',
}];

const roleConfig = {
    user: {
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
};

// 固定的乱序索引数组 / Fixed shuffled index array
// 演示块5延迟到达的效果 / Demonstrate the effect of chunk 5 arriving late
const FIXED_SHUFFLED_INDICES = [
    0,  // sequence_number: 0
    1,  // sequence_number: 1
    2,  // sequence_number: 2
    3,  // sequence_number: 3
    4,  // sequence_number: 4
    // 5,  // sequence_number: 5 (块5延迟到达 / chunk 5 arrives late)
    6,  // sequence_number: 6 (块5被跳过 / chunk 5 skipped)
    6,  // sequence_number: 6 (块6重复到达)
    7,  // sequence_number: 7
    5,  // sequence_number: 5 (块5延迟到达 / chunk 5 arrives late)
    8,  // sequence_number: 8
    9,  // sequence_number: 9
    10, // sequence_number: 10
    11, // sequence_number: 11
    12, // sequence_number: 12 
    13, // sequence_number: 13 
    14, // sequence_number: 14
    15, // sequence_number: 15
    16, // sequence_number: 16
];

export default function StreamingResponseToMessageDemo() {
    const [messages, setMessage] = useState(defaultMessages);
    const [currentState, setCurrentState] = useState(null);
    const [currentLength, setCurrentLength] = useState(0);

    const onChatsChange = useCallback((chats) => {
        setMessage(chats);
    }, []);


    useEffect(() => {

        // 如果已经处理完所有的 chunks，停止 / Stop if all chunks are processed
        if (currentLength > FIXED_SHUFFLED_INDICES.length) {

            console.log('=== All chunks processed ===');
            return;
        }

        // 设置定时器，每 1 秒处理一次 / Set timer to process every 1 second
        const timer = setTimeout(() => {
            if (currentLength === 0) {
                // 初始化，不处理任何块 / Initialize, don't process any chunks
                setCurrentLength(1);
                return;
            }

            // 获取前 currentLength 个乱序索引对应的块 / Get chunks corresponding to first currentLength shuffled indices
            const currentIndices = FIXED_SHUFFLED_INDICES.slice(0, currentLength);
            const currentChunks = currentIndices.map(index => REASONING_CHUNKS[index]);


            // 调用累积函数 / Call accumulation function
            const result = streamingResponseToMessage(currentChunks, currentState);
            
            if (result) {
                const { message: responseMessage, nextState } = result;

                // 更新消息列表 / Update message list
                if (responseMessage) {
                    setMessage([...defaultMessages, responseMessage]);
                }
                
                // 更新状态供下次使用 / Update state for next iteration
                setCurrentState(nextState);
            }

            // 增加长度 / Increase length
            setCurrentLength(prev => prev + 1);
        }, 200);

        // 清理定时器 / Cleanup timer
        return () => clearTimeout(timer);
    }, [currentLength, currentState, REASONING_CHUNKS]);
  
    return (
        <div>
            <div style={{ 
                padding: '12px', 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                marginBottom: '10px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
                <div style={{ marginBottom: '8px' }}>
                    <strong>流式输出模拟 / Streaming Simulation</strong>
                </div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    📊 当前进度 / Progress: {Math.max(0, currentLength - 1)} / {FIXED_SHUFFLED_INDICES.length} chunks
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                    🔀 乱序传输 / Out-of-order transmission
                </div>
                {currentState?.buffer?.size > 0 && (
                    <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                        📦 缓冲区 / Buffer: {currentState.buffer.size} 个块等待处理 / chunks waiting
                    </div>
                )}
            </div>
            <AIChatDialogue 
                align="leftRight"
                mode="bubble"
                chats={messages}
                roleConfig={roleConfig}
                onChatsChange={onChatsChange}
            />
        </div>
    );
};