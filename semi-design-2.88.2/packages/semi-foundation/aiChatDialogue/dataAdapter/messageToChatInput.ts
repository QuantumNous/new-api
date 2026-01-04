import { Message, ContentItem, InputMessage, } from "../foundation";
import { Attachment, Content, MessageContent } from "../../aiChatInput/interface";

export default function messageToChatInput(message: Message): MessageContent {
   

    const attachments: Attachment[] = [];
    const inputContents: ContentItem[] = [];
    // const setup: Setup = {
    //     model: message.model,
    //     thinkType: message.thinkType,
    //     thinkTime: message.thinkTime,
    //     thinkDepth: message.thinkDepth,
    // };

    if (message.content && typeof message.content === 'string') {
        return {
            references: message?.references, 
            attachments, 
            inputContents: [{ type: 'text', text: message.content }], 
            // setup
        };
    } else if (message.content && Array.isArray(message.content)) {
        
        (message.content as ContentItem[]).forEach((messageItem: ContentItem) => {
            if (messageItem.type === 'message') {
                const { content } = messageItem as InputMessage;
                (content as ContentItem[]).forEach((item: any) => {
                    if (item.type === 'input_text') {
                        inputContents.push({
                            type: 'text',
                            text: item?.text,
                        });
                    } else if (item.type === 'input_image') {
                        attachments.push({
                            name: item?.name,
                            url: item?.image_url,
                            status: 'success',
                            size: item?.size,
                            uid: item?.uid,
                        });
                    } else if (item.type === 'input_file') {
                        attachments.push({
                            name: item?.filename,
                            url: item?.file_url,
                            status: 'success',
                            size: item?.size,
                            uid: item?.uid,
                        });
                    }
                });
            }
        });
    }

    return {
        references: message?.references, 
        attachments, 
        inputContents: inputContents as Content[], 
        // setup
    };
}
