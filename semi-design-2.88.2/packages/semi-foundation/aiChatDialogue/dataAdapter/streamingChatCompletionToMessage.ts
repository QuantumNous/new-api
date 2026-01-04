import { FunctionToolCall, Message, OutputMessage, OutputText, Refusal } from '../foundation';
import { ChatCompletionChunk, ChatCompletionToolCall } from './interface';
import { cloneDeep } from 'lodash';
 

// 状态对象：记录每个请求 id + choice index 已处理的 chunk 数量
export interface StreamingChatState {
    processedCountByIndex?: Record<string, number>;
    previousResult?: Message[]
}

export default function streamingChatCompletionToMessage(chatCompletionChunks: ChatCompletionChunk[], state?: StreamingChatState): { messages: Message[]; state?: StreamingChatState } { // There may be N answers, so the return value is a Message array

    const groupedChunks = groupByIndex(chatCompletionChunks);

    const results = groupedChunks.map((chatCompletionChunks: ChatCompletionChunk[], groupIndex: number) => {
        const id = chatCompletionChunks[0].id;
        const status = getStatus(chatCompletionChunks);

        // 基于 state 增量处理：仅处理新到达的 chunk 片段
        const stateKey = `${id}:${chatCompletionChunks[0]?.choices?.[0]?.index ?? groupIndex}`;
        const processedCount = state?.processedCountByIndex?.[stateKey] ?? 0;
        const start = processedCount > 0 ? Math.min(processedCount, chatCompletionChunks.length) : 0;
        const chunksToProcess = state ? chatCompletionChunks.slice(start) : chatCompletionChunks;

        // 若提供了 state 且本次没有新增内容，则跳过该 index
        if (state && chunksToProcess.length === 0) {
            return state.previousResult?.[groupIndex];
        }

        const previousResult = state?.previousResult?.[groupIndex];
        let textContent = '';
        let refusal = '';
        let functionCall = { name: '', arguments: '' };
        let toolCalls = [];

        (previousResult?.content as OutputMessage[])?.forEach((item: OutputMessage) => {
            item.content?.forEach((content: OutputText | Refusal | FunctionToolCall) => {
                if (content.type === 'output_text') {
                    textContent += (content as OutputText).text;
                }
                if (content.type === 'refusal') {
                    refusal += (content as Refusal).refusal;
                }
            });
            if (item.type === 'function_call' && !item.id) {
                // Chat Completion function call does not have id
                functionCall.name = (item as FunctionToolCall).name;
                functionCall.arguments = (item as FunctionToolCall).arguments;
            }
            if (item.type === 'tool_call' || (item.type === 'function_call' && item.id)) {
                toolCalls.push(item);
            }
        });

        chunksToProcess.map((chunk: ChatCompletionChunk) => {
            const delta = chunk.choices[0].delta;
            if (delta?.content) {
                textContent += delta.content;
            }
            if (delta?.refusal) {
                refusal += delta.refusal;
            }
            if (delta?.function_call) {
                if (delta.function_call.name) {
                    functionCall.name += delta.function_call.name;
                }
                functionCall.arguments += delta.function_call.arguments;
            }
            if (delta?.tool_calls) {
                delta?.tool_calls.forEach((toolCall: ChatCompletionToolCall) => {
                    // Chat Completion tool call may be function call or custom call
                    const curToolCall = toolCalls.find((item: ChatCompletionToolCall) => item.id === toolCall.id);
                    if (curToolCall) {
                        if (toolCall?.function?.name) {
                            curToolCall.name += toolCall.function.name;
                            curToolCall.arguments += toolCall.function.arguments;
                        } else if (toolCall?.custom?.name) {
                            curToolCall.name += toolCall.custom.name;
                            curToolCall.input += toolCall.custom.input;
                        }
                        curToolCall.status = status;
                    } else {
                        toolCalls.push({
                            ...(toolCall as ChatCompletionToolCall)?.function,
                            ...(toolCall as ChatCompletionToolCall)?.custom,
                            type: (toolCall as ChatCompletionToolCall)?.function ? 'function_call' : 'custom_call',
                            id: toolCall.id,
                        });
                    }
                });
            }
        });

        const outputMessage = [
            textContent !== '' && {
                type: 'output_text',
                text: textContent,
            },
            refusal !== '' && {
                type: 'refusal',
                refusal: refusal,
            },
        ].filter(Boolean);


        const outputResult = [
            outputMessage.length > 0 && {
                type: 'message',
                id: id,
                role: 'assistant',
                status: status,
                content: outputMessage
            },
            functionCall.name !== '' && {
                type: 'function_call',
                ...functionCall
            },
            ...toolCalls,
        ].filter(Boolean);

        // 更新 state：记录该 index 已处理到的 chunk 数量
        if (state && state.processedCountByIndex) {
            state.processedCountByIndex[stateKey] = chatCompletionChunks.length;
        } else {
            state = {
                processedCountByIndex: {
                    [stateKey]: chatCompletionChunks.length,
                },
            };
        }

        return {
            id: id,
            role: "assistant",
            content: outputResult,
            status: status,
        };
    }).filter(Boolean) as Message[];

    state.previousResult = cloneDeep(results);
    
    return {
        messages: results,
        state: state 
    }; 
}

const groupByIndex = (chatCompletionChunks: ChatCompletionChunk[]) => {
    const groupedChunks = [];
    chatCompletionChunks.forEach((chunk) => {
        // 确保每个 chunk 的 choices 都存在且为长度为 1 的数组
        // Make sure that each chunk's choices exists and is an array of length 1.
        chunk.choices.forEach((choice) => {
            const curIndex = choice.index;
            if (!groupedChunks[curIndex]) {
                groupedChunks[curIndex] = [];
            }
            groupedChunks[curIndex].push({
                ...chunk,
                choices: [choice],
            });
        });
    });
    return groupedChunks;
};

const getStatus = (chatCompletionChunks: ChatCompletionChunk[]) => {
    const lastChunk = chatCompletionChunks[chatCompletionChunks.length - 1];
    return lastChunk.choices[0].finish_reason !== null ? 'completed' : 'in_progress';
};