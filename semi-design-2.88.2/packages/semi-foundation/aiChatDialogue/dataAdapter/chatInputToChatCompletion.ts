import { AudioContentPart, ChatCompletionInput, ImageContentPart, FileContentPart, TextInput } from './interface';
export default function chatInputToChatCompletion(inputContent: any): ChatCompletionInput { // todo: 合入 aiChatInput 后补充类型定义
    const { references, attachments, inputContents, setup } = inputContent;

    let inputs: (ImageContentPart | AudioContentPart | FileContentPart | TextInput)[] = [];

    if (attachments?.length) { // todo: attachment 允许传递目录？
        attachments.forEach((item: any) => {
            const { name, url } = item;
            if (name.includes('.png') || name.includes('.jpg') || name.includes('.jpeg')) {
                inputs.push({
                    type: 'image_url',
                    image_url: {
                        url: url,
                    },
                });
            } else {
                // Inputs by file URL are not supported for chat completions. Use the ResponsesAPI for this option.
                inputs.push({
                    type: 'file',
                    file: {
                        file_data: item.file_data,
                        filename: name,
                        file_id: item?.id,
                    },
                });
            }
        });
    }

    if (inputContents?.length) {
        inputContents.forEach((item: any) => {
            inputs.push({
                type: 'text',
                text: item.text,
            });
        });
    }

    return {
        role: "user",
        messages: [{
            role: "user",
            content: inputs,
        }],
        model: setup?.model,
        references,
        setup: setup ?? {}
    };

}
