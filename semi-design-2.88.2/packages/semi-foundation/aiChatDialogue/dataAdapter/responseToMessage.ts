import { Message, ContentItem } from '../foundation';
import { Response } from './interface';

export default function responseToMessage(response: Response): Message {
    const { id, model, status, output, output_text, created_at } = response;

    return {
        id: id,
        role: "assistant",
        content: output as (string | ContentItem[]),
        createdAt: created_at,
        output_text: output_text,
        model: model,
        status: status,
    };
}