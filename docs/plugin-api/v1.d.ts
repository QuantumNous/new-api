export type JSONValue = null | boolean | number | string | readonly JSONValue[] | {readonly [key: string]: JSONValue};
export type FileReference = Readonly<{ref: string; field: string; filename: string; mimeType: string; size: number}>;
export type FilePlaceholder = Readonly<{__fileRef: string; encoding: "base64" | "dataUrl"; mimeType?: string; maxBytes?: number}>;
export type DecodedBody =
  | Readonly<{kind: "json"; value: JSONValue}>
  | Readonly<{kind: "form"; fields: Readonly<Record<string, readonly string[]>>}>
  | Readonly<{kind: "multipart"; fields: Readonly<Record<string, readonly string[]>>; files: readonly FileReference[]}>
  | Readonly<{kind: "none"}>;

export interface NativeDecodeContext {method: string; path: string; params: Readonly<Record<string, string>>; query: Readonly<Record<string, readonly string[]>>; body: DecodedBody}
export interface ProtocolDecodeContext extends NativeDecodeContext {protocol: "openai_responses" | "openai_video"; operation: string; model: string; stream: boolean}
export type SubmitIntent = {kind: "submit"; model: string; action?: string; requestBody?: unknown; originTaskIds?: readonly string[]};
export type QueryIntent = {kind: "query"; taskIds: readonly string[]};
export type TaskIntent = SubmitIntent | QueryIntent;
export interface NativeRoute {method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string; type: "submit" | "query" | "dynamic"; action?: string; taskIdParam?: string; decode?: string; render: string; models?: readonly string[]}
export type ProtocolName = "openai_responses" | "openai_video";
export type ResponsesMode = "stream" | "sync" | "background";
export type ProtocolClaim =
  | "openai_video"
  | {name: "openai_responses"; supports: readonly ResponsesMode[]; models?: readonly string[]}
  | {name: "openai_video"; models?: readonly string[]};
export type LocalizedText = string | ({ en: string } & Record<string, string>);
export type UsageFieldSchema = {type: "number"; unit: "second" | "count" | "token" | "credit"; description?: LocalizedText} | {type: "boolean"; description?: LocalizedText} | {enum: readonly string[]; description?: LocalizedText};
export type UsageExample = {label: string; facts: Readonly<Record<string, string | number>>};
export interface Meta {apiVersion: 1; key: string; name: string; icon?: string; description?: LocalizedText; version: string; author: {name: string; url?: string}; channelTypes?: readonly number[]; models: readonly string[]; fetchMode: "per_task" | "batch"; allowedHosts?: readonly string[]; routes?: readonly NativeRoute[]; protocols?: readonly ProtocolClaim[]; usageSchema?: Readonly<Record<string, UsageFieldSchema>>; usageExamples?: readonly UsageExample[]; auth?: "none" | "api_key" | "vertex_oauth" | {type: "none" | "api_key" | "oauth2_jwt"}}
export interface TaskView {task_id: string; status: string; progress?: string; fail_reason?: string; created_at?: number; updated_at?: number; data?: unknown; properties?: Record<string, unknown>}
export interface DriverContext {requestBody: unknown; requestHeaders: Readonly<Record<string, string>>; action: string; model: string; upstreamModel: string; baseUrl: string; apiKey?: string; authHeader: string; files: readonly FileReference[]; publicTaskId: string; originTasks?: readonly {taskId: string; upstreamTaskId: string; action: string; status: string; data: unknown}[]}
export interface RequestDescriptor {url: string; method?: string; headers?: Record<string, string>; /** JSON body may contain FilePlaceholder objects at any depth; the host replaces each with a Base64 or data-URL string. */ body?: unknown; credentialless?: boolean; action?: string; model?: string; rewriteModel?: string; bodyType?: "json" | "multipart"; parts?: readonly {name: string; value?: unknown; fileRef?: string; filename?: string}[]}
export interface UpstreamResponse {statusCode: number; headers: Readonly<Record<string, readonly string[]>>; body: unknown}
export interface NormalizedTaskResult {taskId?: string; status: "NOT_START" | "SUBMITTED" | "QUEUED" | "IN_PROGRESS" | "SUCCESS" | "FAILURE" | "UNKNOWN"; progress?: string; reason?: string; url?: string; remoteUrl?: string; completionTokens?: number; totalTokens?: number}
export interface TaskArtifact {key: string; type: "video" | "audio" | "image" | "file"; mimeType?: string}
export declare const meta: Meta;
export declare const native: Record<string, ((ctx: NativeDecodeContext) => TaskIntent) | ((ctx: NativeDecodeContext, task: TaskView | readonly TaskView[]) => unknown)> & {error?: (ctx: NativeDecodeContext, error: {code: string; message: string; httpStatus: number; retryable: boolean}) => unknown};
export declare const protocols: {
  openai_responses?: {decodeRequest(ctx: ProtocolDecodeContext): SubmitIntent; renderEvents?(ctx: unknown, task: TaskView, previousState: unknown): unknown; renderFinal?(ctx: unknown, task: TaskView): unknown};
  openai_video?: {decodeRequest(ctx: ProtocolDecodeContext): SubmitIntent; render(ctx: unknown, task: TaskView): unknown};
};
export declare function buildSubmitRequest(ctx: DriverContext): RequestDescriptor;
export declare function parseSubmitResponse(ctx: DriverContext, response: UpstreamResponse): {taskId: string; taskData?: unknown; immediate?: NormalizedTaskResult};
export declare function buildQueryRequest(ctx: DriverContext & {taskId: string}): RequestDescriptor;
export declare function buildBatchQueryRequest(ctx: DriverContext, taskIds: readonly string[]): RequestDescriptor;
export declare function parseTaskResult(ctx: DriverContext, body: unknown): NormalizedTaskResult;
export declare function parseBatchResult(ctx: DriverContext, body: unknown): readonly (NormalizedTaskResult & {taskId: string; data?: unknown})[];
export declare function extractUsage(ctx: DriverContext & {usagePurpose?: "facts" | "billing_ratios"}): Readonly<Record<string, string | number | boolean>> | null;
export declare function extractUsageOnSubmit(ctx: DriverContext, taskData: unknown): Readonly<Record<string, string | number | boolean>> | null;
export declare function extractUsageOnComplete(task: TaskView, result: NormalizedTaskResult, data: unknown): Readonly<Record<string, string | number | boolean>> | null;
export declare function listArtifacts(task: {taskId: string; status: string; action: string; data: unknown; producerVersion: string}): readonly TaskArtifact[];
export declare function buildContentRequest(ctx: DriverContext & {artifactKey: string; data: unknown; upstreamTaskId: string; clientRequest: {method: "GET" | "HEAD"; headers: Readonly<Record<string, string>>}}): RequestDescriptor;
