import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-ai-chat-dialogue`,
    PREFIX_ACTION: `${BASE_CLASS_PREFIX}-ai-chat-dialogue-action`,
    PREFIX_CONTENT: `${BASE_CLASS_PREFIX}-ai-chat-dialogue-content`,
    PREFIX_REASONING: `${BASE_CLASS_PREFIX}-ai-chat-dialogue-reasoning`,
    PREFIX_ANNOTATION: `${BASE_CLASS_PREFIX}-ai-chat-dialogue-annotation`,
    PREFIX_REFERENCES: `${BASE_CLASS_PREFIX}-ai-chat-dialogue-references`,
    PREFIX_REFERENCE: `${BASE_CLASS_PREFIX}-ai-chat-dialogue-reference`,
    PREFIX_STEP: `${BASE_CLASS_PREFIX}-ai-chat-dialogue-step`,
    PREFIX_CODE: `${BASE_CLASS_PREFIX}-ai-chat-dialogue-code`,
    PREFIX_HINT: `${BASE_CLASS_PREFIX}-ai-chat-dialogue-hint`,
};
const SCROLL_ANIMATION_TIME = 300;
const SHOW_SCROLL_GAP = 100;

const ROLE = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system',
};

const DIALOGUE_ALIGN = {
    LEFT_RIGHT: 'leftRight',
    LEFT_ALIGN: 'leftAlign',
};

const STATUS = {
    QUEUED: 'queued',
    IN_PROGRESS: 'in_progress',
    INCOMPLETE: 'incomplete',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

const MODE = {
    BUBBLE: 'bubble',
    NO_BUBBLE: 'noBubble',
    USER_BUBBLE: 'userBubble'
};

const SEND_HOT_KEY = {
    ENTER: 'enter',
    SHIFT_PLUS_ENTER: 'shift+enter'
};

const MESSAGE_ITEM_TYPE = {
    // Response output items
    MESSAGE: 'message',
    OUTPUT_TEXT: 'output_text',
    REFUSAL: 'refusal',
    FILE_SEARCH_CALL: 'file_search_call',
    FUNCTION_CALL: 'function_call',
    WEB_SEARCH_CALL: 'web_search_call',
    REASONING: 'reasoning',
    MCP_CALL: 'mcp_call',
    CUSTOM_TOOL_CALL: 'custom_tool_call',
    IMAGE_GENERATION_CALL: 'image_generation_call',
    MCP_LIST_TOOLS: 'mcp_list_tools',
    // Request input items
    INPUT_TEXT: 'input_text',
    INPUT_IMAGE: 'input_image',
    INPUT_FILE: 'input_file',
    STEPS: 'steps',
    ITEM_REFERENCE: 'item_reference',
};

const FINISH_REASON = {
    STOP: 'stop',
    LENGTH: 'length',
    CONTENT_FILTER: 'content_filter',
    TOOL_CALLS: 'tool_calls',
    FUNCTION_CALL: 'function_call'
};

const TEXT_TYPES = [
    MESSAGE_ITEM_TYPE.INPUT_TEXT, 
    MESSAGE_ITEM_TYPE.OUTPUT_TEXT, 
    MESSAGE_ITEM_TYPE.REFUSAL
];

const TOOL_CALL_TYPES = [
    MESSAGE_ITEM_TYPE.FUNCTION_CALL, 
    MESSAGE_ITEM_TYPE.CUSTOM_TOOL_CALL, 
    MESSAGE_ITEM_TYPE.MCP_CALL
];

const DOCUMENT_TYPES = [ 'doc', 'docx', 'txt', 'word'];
const IMAGE_TYPES = [ 'jpeg', 'jpg', 'png', 'gif'];
const PDF_TYPES = [ 'pdf'];
const EXCEL_TYPES = [ 'excel', 'xlsx', 'xls'];
const CODE_TYPES = [ 'json', 'js', 'ts', 'jsx', 'tsx'];
const VIDEO_TYPES = [ 'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'];


const strings = {
    SCROLL_ANIMATION_TIME,
    SHOW_SCROLL_GAP,
    STATUS,
    ROLE,
    DIALOGUE_ALIGN,
    MODE,
    SEND_HOT_KEY,
    MESSAGE_ITEM_TYPE,
    FINISH_REASON,
    TEXT_TYPES,
    TOOL_CALL_TYPES,
    DOCUMENT_TYPES,
    IMAGE_TYPES,
    PDF_TYPES,
    EXCEL_TYPES,
    CODE_TYPES,
    VIDEO_TYPES
};

export { cssClasses, strings };
