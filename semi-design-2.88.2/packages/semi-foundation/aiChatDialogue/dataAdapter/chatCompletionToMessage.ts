import { Message } from '../foundation';
import { ChatCompletion, Choice, ChatCompletionToolCalls, ChatCompletionToolCall, ChatCompletionCustomToolCall } from './interface';
/* 
Chat Completion VS. Response
- The former only have content、refusal、function_call、tool_calls; 
- The former annotations belongs to content;
- The former function_call and tool_calls do not have call_id and status;
*/
export default function chatCompletionToMessage(chatCompletion: ChatCompletion): Message[] {
    return chatCompletion.choices.map((choice: Choice) => {
        const message = choice.message;
        const role = message.role;
        const id = chatCompletion.id;
        const status = 'completed'; 

        const outputResult = [];
        
        // processing text and refusal
        if (message.content !== '' || message.refusal !== '') {
            const annotations = (message.annotations?.length
                ? message.annotations.map((annotation) => ({
                    type: annotation.type,
                    ...(annotation.url_citation || {}),
                }))
                : []);

            const outputMessage = [
                message.content !== '' && {
                    type: 'output_text',
                    text: message.content,
                    annotations,
                },
                message.refusal !== '' && {
                    type: 'refusal',
                    refusal: message.refusal,
                },
            ].filter(Boolean);

            outputResult.push({
                type: 'message',
                id: id,
                role: 'assistant',
                status: status,
                content: outputMessage
            });
        }

        // processing function call
        if (message.function_call) {
            outputResult.push({
                ...message.function_call,
                type: 'function_call',
                status: 'completed',
            });
        }

        // processing tool calls
        if (message?.tool_calls?.length) {
            const toolCalls = message.tool_calls.map((toolCall: ChatCompletionToolCalls) => {
                if (toolCall.type === 'function') {
                    return {
                        status: 'completed',
                        ...(toolCall as ChatCompletionToolCall).function,
                        type: 'function_call',
                        // todo: call_id?
                    };
                }
                return {
                    ...(toolCall as ChatCompletionCustomToolCall).custom,
                    type: 'custom_call',
                };
            });
            outputResult.push(...toolCalls);
        }

        // Currently, the Response API does not support voice output, but chat completion does.
        if (message.audio) {
            outputResult.push({
                type: 'audio',
                ...message.audio,
            });
        }

        return {
            id: id,
            role: role,
            content: outputResult,
            status: status,
        };
    });
}
