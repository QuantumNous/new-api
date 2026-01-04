import { MessageContent } from "../../aiChatInput/interface";


export default function chatInputToMessage(inputContent: MessageContent) { 
    const { references, attachments, inputContents, setup } = inputContent;

    let inputs: any[] = [];

    if (attachments?.length) { 
        attachments.forEach((item: any) => {
            const { name, url } = item;
            if (name.includes('.png') || name.includes('.jpg') || name.includes('.jpeg')) {
                inputs.push({
                    ...item,
                    type: 'input_image',
                    image_url: url,
                    detail: 'auto',
                });
            } else {
                inputs.push({
                    ...item,
                    type: 'input_file',
                    file_url: url, 
                    filename: name,
                });
            }
        });
    }

    if (inputContents?.length) {
        inputContents.forEach((item: any) => {
            inputs.push({
                type: 'input_text',
                text: item.text,
            });
        });
    }

    return {
        role: "user",
        content: [{
            type: 'message',
            role: 'user',
            content: inputs,
        }],
        model: setup?.model,
        references,
        setup: setup ?? {}
    };
}
