import { ContentItem, OutputText, Refusal } from "../foundation";

export interface ChatCompletion {
    id?: string;
    object?: string;
    created?: number;
    model?: string;
    choices?: Choice[];
    usage?: Usage;
    service_tier?: string;
    system_fingerprint?: string
}

export interface ChatCompletionChunk {
    id?: string;
    object?: string;
    created?: number;
    model?: string;
    choices?: ChoiceChunk[];
    usage?: Usage;
    service_tier?: string;
    system_fingerprint?: string
}

export interface Choice {
    index?: number;
    message?: ChatCompletionMessage;
    logprobs?: Logprobs;
    finish_reason?: string
}

export interface ChoiceChunk {
    index?: number;
    delta?: Delta;
    logprobs?: Logprobs;
    finish_reason?: string
}

export interface Delta {
    role?: string;
    content?: string;
    refusal?: string;
    function_call?: FunctionCall;
    tool_calls?: ChatCompletionToolCall[]
}


interface ChatCompletionMessage {
    role?: string;
    content?: string;
    refusal?: string;
    annotations?: ChatCompletionAnnotation[];
    audio?: Audio;
    function_call?: FunctionCall;
    tool_calls?: ChatCompletionToolCalls[]
}

export type ChatCompletionToolCalls = ChatCompletionToolCall | ChatCompletionCustomToolCall 

interface ChatCompletionAnnotation {
    type?: string;
    url_citation?: URLCitation
}

interface URLCitation {
    end_index?: number;
    start_index?: number;
    title?: string;
    url?: string
}

interface Audio {
    data: string;
    expires_at?: number;
    id?: string;
    transcript?: string
}

interface FunctionCall {
    name?: string;
    arguments?: string
}

interface ToolCall {
    input?: string;
    name?: string
}

export interface ChatCompletionToolCall {
    id?: string;
    index?: number;
    type?: string;
    function?: FunctionCall;
    custom?: ToolCall
}

export interface ChatCompletionCustomToolCall {
    id?: string;
    type?: string;
    custom?: ToolCall
}

interface Logprobs {
    content?: LogprobsContent[];
    refusal?: LogprobsContent[]
}

interface LogprobsContent {
    bytes?: number[];
    logprob?: number;
    token?: string;
    top_logprobs?: LogprobsContent[]
}


interface Usage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    completion_tokens_details?: CompletionTokensDetails;
    prompt_tokens_details?: PromptTokensDetails
}

interface CompletionTokensDetails {
    reasoning_tokens?: number;
    audio_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number
}

interface PromptTokensDetails {
    cached_tokens?: number;
    audio_tokens?: number
}


export interface Response {
    id?: string;
    created_at?: number;
    error?: ResponseError;
    incomplete_details?: {
        reason: string
    };
    max_output_tokens?: number;
    max_tool_calls?: number;
    model?: string;
    object?: string;
    output?: ContentItem | ContentItem[];
    output_text?: string;
    parallel_tool_calls?: boolean;
    previous_response_id?: string;
    reasoning?: ResponseReasoning;
    safety_identifier?: string;
    status?: string;
    temperature?: number;
    top_logprobs?: number;
    top_p?: number;
    truncation?: string;
    [x: string]: any
}

export interface ResponseError {
    code?: string;
    message?: string
}

interface ResponseReasoning {
    effort?: string;
    generate_summary?: string;
    summary?: string
}

export interface ResponseChunk {
    type?: string;
    response?: Response;
    sequence_number?: number;
    output_index?: number;
    item?: ContentItem;
    content_index?: number;
    item_id?: string;
    part?: OutputText | Refusal | ReasoningText;
    delta?: string;
    refusal?: string;
    name?: string;
    arguments?: string;
    summary_index?: number;
    text?: string;
    code?: string;
    message?: string;
    param?: string;
    [x: string]: any
}

interface ReasoningText {
    text?: string;
    type?: string
}

export interface CodeInterpreterCall {
    code?: string;
    status?: string;
    outputs?: {
        logs?: string;
        url?: string;
        type?: string
    }[];
    id?: string;
    container_id?: string;
    type?: string
}

export interface ImageGenerationCall {
    id?: string;
    result?: string;
    status?: string;
    type?: string
}


// chat completion input
export interface ChatCompletionInput {
    messages?: ChatCompletionInputMessage[];
    model?: string;
    audio?: {
        format: string;
        voice: string
    };
    function_call?: string | { name: string };
    functions?: { name: string; description: string }[];
    n?: number;
    modalities?: string[];
    [x: string]: any
}

export type ChatCompletionInputMessage = DeveloperMessage | SystemMessage | UserMessage | AssistantMessage | ToolMessage | FunctionMessage;

interface CommonInputItem {
    role?: string;
    name?: string
}

interface DeveloperMessage extends CommonInputItem {
    content?: string | { type: string; text: string }[]
}

interface SystemMessage extends CommonInputItem {
    content?: string | any[]
}

export interface UserMessage extends CommonInputItem {
    content?: string | (ImageContentPart | AudioContentPart | FileContentPart | TextInput)[]
}

export interface TextInput {
    text?: string;
    type?: string
}

export interface ImageContentPart {
    image_url?: {
        url?: string;
        detail?: string
    };
    type?: string
}

export interface AudioContentPart {
    input_audio?: {
        data?: string;
        format?: string
    };
    type?: string
}

export interface FileContentPart {
    file?: {
        file_data?: string;
        file_id?: string;
        filename?: string
    };
    type?: string
}

interface AssistantMessage extends CommonInputItem {
    audio?: { id: string };
    content?: string | (OutputText | Refusal)[];
    function_call?: { name: string; arguments: string };
    name?: string;
    refusal?: string;
    tool_calls?: (ChatCompletionToolCall | ChatCompletionCustomToolCall)[]
}

interface ToolMessage extends CommonInputItem {
    content?: string | any[]
}

interface FunctionMessage extends CommonInputItem {
    content?: string 
}

export interface StreamingResponseState {
    processedSeq: Set<number>;
    outputs: Map<number, ContentItem | null>;
    meta: {
        id?: string;
        model?: string;
        status?: string;
        created_at?: number
    };
    error?: ResponseError;
    buffer: Map<number, ResponseChunk>;
    lastProcessedSeq: number
}