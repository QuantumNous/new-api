import { Attachment, BaseSkill, Reference } from "./interface";
import { strings } from './constants';

export function getAttachmentType(item: Attachment | Reference) {
    const { type, name, fileInstance } = item ?? {};
    if (type) {
        return type;
    }
    const suffix = name?.split('.').pop();
    return suffix ?? fileInstance?.type?.split('/').pop() ?? 'UNKNOWN';
}

export function isImageType(item: Attachment | Reference) {
    const { name, fileInstance } = item ?? {};
    const suffix = name?.split('.').pop();
    return fileInstance?.type?.startsWith(strings.PIC_PREFIX) || strings.PIC_SUFFIX_ARRAY.includes(suffix);
}

export function getContentType(type: string) {
    const objMap = new Map([
        // 文档
        ['docx', 'word'], ['doc', 'word'], ['txt', 'word'], ['epub', 'word'], ['mobi', 'word'],
        // 代码
        ['js', 'code'], ['ts', 'code'], ['jsx', 'code'], ['tsx', 'code'], ['java', 'code'], ['py', 'code'], ['c', 'code'],
        ['cpp', 'code'], ['go', 'code'], ['rust', 'code'], ['php', 'code'], ['sql', 'code'], ['html', 'code'], ['css', 'code'],
        ['scss', 'code'], ['less', 'code'], ['md', 'code'], ['json', 'code'],
        // 表格
        ['xlsx', 'excel'], ['xls', 'excel'], ['pptx', 'ppt'], ['ppt', 'ppt'],  
        // 视频
        ['mp4', 'video'], ['mkv', 'video'], ['avi', 'video'], ['mov', 'video'], ['wmv', 'video'],
        ['prores', 'video'], ['flv', 'video'], ['ts', 'video'], ['webm', 'video'], ['3gp', 'video'],
        // 音频
        ['flac', 'audio'], ['wav', 'audio'], ['alac', 'audio'], ['ape', 'audio'], ['mp3', 'audio'],
        ['aac', 'audio'], ['ogg', 'audio'], ['wma', 'audio'], ['m4a', 'audio'], ['amr', 'audio'],
        ['midi', 'audio'],
        // 图片
        ['png', 'image'], ['jpg', 'image'], ['jpeg', 'image'], ['gif', 'image'], ['bmp', 'image'], ['webp', 'image'],
        // pdf
        ['pdf', 'pdf'],
    ]);
    const result = objMap.get(type) ?? 'unknown';
    return result;
}

export function transformSelectSlot(obj: any) {
    const { attrs = {} } = obj;
    const { value = '' } = attrs;
    return {
        type: 'text',
        text: value,
    };
}

export function transformSkillSlot(obj: any) {
    const { type, attrs } = obj;
    const { value, label, hasTemplate } = attrs;
    return omitUndefinedFromObj({ type, value, label, hasTemplate });
}

export function transformInputSlot(obj: any) {
    const { content = [], attrs } = obj;
    const text = content?.[0]?.text ?? '';
    return {
        type: 'text',
        text: (text !== strings.ZERO_WIDTH_CHAR && text.length) ? text : attrs?.placeholder,
    };
}

export function transformText(obj: any) {
    const { text } = obj;
    return { 
        type: 'text',
        text: text !== strings.ZERO_WIDTH_CHAR ? text : ''
    };
}

export const transformMap = new Map<string, any>([
    ['text', transformText],
    ['selectSlot', transformSelectSlot],
    ['inputSlot', transformInputSlot],
    ['skillSlot', transformSkillSlot],
]);

export function transformJSONResult(input: any, customTransformObj: Map<string, (obj: any) => any> = new Map()) {
    const output: any[] = [];

    const traverse = (obj: any) => {
        const { type, content = [] } = obj;
        let result: any;
        switch (type) {
            case 'doc':
                content.forEach((item: any) => {
                    traverse(item);
                });
                break;
            case 'paragraph':
                if (output.length > 0) {
                    const lastItem = output[output.length - 1];
                    if (lastItem && lastItem.type === 'text') {
                        lastItem.text += '\n';
                    } else {
                        output.push({ type: 'text', text: '\n' });
                    }
                }
                content.forEach((item: any) => {
                    traverse(item);
                });
                break;
            default:
                const transformFn = transformMap.get(type) ?? customTransformObj.get(type);
                result = transformFn?.(obj);
                break;
        }
        if (result) {
            if (result.type === 'text') {
                const lastItem = output[output.length - 1];
                if (lastItem && lastItem.type === 'text') {
                    lastItem.text += result.text;
                } else if (typeof result.text === 'string') {
                    // 如果 result.text 为空字符串（比如text 节点中只有单个的零宽字符），则无需作为 output 结果
                    // if result.text is an empty string，then it does not need to be included in output result.
                    result.text.length && output.push(result);
                } else {
                    output.push(result);
                }
            } else {
                output.push(result);
            }
        }
    };

    traverse(input);
    return output;
}

export function getCustomSlotAttribute() {
    return {
        default: true,
        parseHTML: element => true,
        renderHTML: attributes => ({
            'data-custom-slot': attributes.isCustomSlot ? true : undefined,
        }),
    };
}

export function findSkillSlotInString(content: string) {
    const reg = /<skill-slot\s+([^>]*)><\/skill-slot>/i;
    const attrReg = /([\w-]+)=["']?([^"'\s>]+)["']?/g;
    const match = reg.exec(content);
    if (match) {
        const attrsStr = match[1];
        let attrMatch;
        let attrs = {};
        while ((attrMatch = attrReg.exec(attrsStr)) !== null) {
            attrs[attrMatch[1]] = attrMatch[2];
        }
        if (attrs['data-value']) {
            const obj = {
                label: attrs['data-label'],
                value: attrs['data-value'],
                hasTemplate: attrs['data-template'] ? attrs['data-template'] === 'true' : undefined
            };
            return omitUndefinedFromObj(obj);
        }
    }
    return undefined;
}


function omitUndefinedFromObj(obj: { [key: string]: any }) {
    return Object.fromEntries(
        Object.entries(obj).filter(([key, value]) => value !== undefined)
    );
}

export function getSkillSlotString(skill: BaseSkill) {
    let skillParams = '';
    skill.label && (skillParams += ` data-label=${skill.label}`);
    skill.value && (skillParams += ` data-value=${skill.value}`);
    (typeof skill.hasTemplate === 'boolean') && (skillParams += ` data-template=${skill.hasTemplate}`);
    return `<skill-slot ${skillParams}"></skill-slot>`;
}