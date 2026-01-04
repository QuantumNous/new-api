import { ContentItem, OutputMessage, OutputText, Reasoning, Refusal, FunctionToolCall, CustomToolCall, MCPToolCall, Message } from "../foundation";
import { CodeInterpreterCall, ImageGenerationCall, ResponseChunk, StreamingResponseState } from "./interface";



/**
 * Incremental reducer for streaming Response chunks with out-of-order handling.
 * 增量处理流式响应块的归约器，支持无序处理。
 * 
 * ## Features / 特性
 * - Only applies chunks that were not processed before (by sequence_number)
 *   只处理之前未处理过的块（根据 sequence_number）
 * 
 * - Maintains reusable state across calls for incremental processing
 *   在多次调用之间保持可复用的状态，支持增量处理
 * 
 * - Always returns a best-effort Message regardless of missing chunks
 *   即使有缺失的块，也总是返回尽力而为的消息
 * 
 * - Handles out-of-order chunks by buffering and processing in sequence
 *   通过缓冲机制处理无序到达的块，确保按顺序处理
 * 
 * ## Out-of-Order Handling / 无序处理机制
 * 
 * 1. **Buffering / 缓冲**
 *    - All incoming chunks are first added to a buffer
 *      所有传入的块首先被添加到缓冲区
 *    - Chunks are stored by their sequence_number as keys
 *      块按其 sequence_number 作为键存储
 * 
 * 2. **Sequential Processing / 顺序处理**
 *    - Only processes chunks with consecutive sequence numbers
 *      仅处理具有连续序列号的块
 *    - Maintains lastProcessedSeq to track the last successfully processed sequence
 *      维护 lastProcessedSeq 来跟踪最后成功处理的序列号
 *    - Uses a do-while loop to process all available consecutive chunks
 *      使用 do-while 循环处理所有可用的连续块
 * 
 * 3. **Tolerance Mechanism / 容错机制**
 *    - If gap between buffered chunks and lastProcessedSeq exceeds MAX_GAP (10)
 *      如果缓冲块与 lastProcessedSeq 之间的间隙超过 MAX_GAP (10)
 *    - Assumes missing chunks won't arrive and processes remaining chunks
 *      则假设缺失的块不会到达，继续处理剩余的块
 *    - Prevents permanent blocking due to lost chunks
 *      防止因丢失块而永久阻塞
 * 
 * ## Example Scenarios / 示例场景
 * 
 * - **Scenario 1 / 场景 1**: In-order arrival / 按序到达
 *   ```
 *   Input: [1, 2, 3] → Process: 1, 2, 3 immediately
 *   输入: [1, 2, 3] → 处理: 立即处理 1, 2, 3
 *   ```
 * 
 * - **Scenario 2 / 场景 2**: Out-of-order arrival / 无序到达
 *   ```
 *   Call 1: [1, 3] → Process: 1, Buffer: 3
 *   Call 2: [2, 4] → Process: 2, 3, 4
 *   调用 1: [1, 3] → 处理: 1，缓冲: 3
 *   调用 2: [2, 4] → 处理: 2, 3, 4
 *   ```
 * 
 * - **Scenario 3 / 场景 3**: Missing chunk with recovery / 缺失块并恢复
 *   ```
 *   Input: [1, 2, 4, 5, ..., 15] → Process: 1, 2, buffer others
 *   After gap > 10 → Skip 3, process 4-15
 *   输入: [1, 2, 4, 5, ..., 15] → 处理: 1, 2，缓冲其他
 *   间隙 > 10 后 → 跳过 3，处理 4-15
 *   ```
 * 
 * @param chunks - Array of incoming response chunks / 传入的响应块数组
 * @param prevState - Previous state from last call (for incremental processing) / 上次调用的状态（用于增量处理）
 * @returns Object containing the accumulated message and next state, or null if no chunks / 包含累积消息和下一个状态的对象，如果没有块则返回 null
 */
export default function streamingResponseToMessage(
    chunks?: ResponseChunk[],
    prevState?: StreamingResponseState
) {
    if (!chunks?.length) return null;

    // Fast path: If last chunk is response.completed, return the complete response directly
    // 快速路径：如果最后一个块是 response.completed，直接返回完整响应
    const tail = chunks[chunks.length - 1];
    if (tail.type === 'response.completed') {
        const { response } = tail;
        const { id, model, status, output, output_text, created_at } = response;
        const message = {
            id: id,
            role: "assistant",
            content: output,
            createdAt: created_at,
            output_text: output_text,
            model: model,
            status: status,
        };
        return { message, nextState: null };
    }

    // Initialize or restore state from previous call
    // 初始化或从上次调用恢复状态
    const state = prevState
        ? {
            // Restore existing state for incremental processing / 恢复现有状态以进行增量处理
            processedSeq: new Set(prevState.processedSeq),  // Track processed sequence numbers / 跟踪已处理的序列号
            outputs: new Map(prevState.outputs),            // Accumulated output items / 累积的输出项
            meta: { ...prevState.meta },                    // Metadata (id, model, status, etc.) / 元数据（id、模型、状态等）
            error: prevState.error ?? null,                 // Error information if any / 错误信息（如果有）
            buffer: new Map(prevState.buffer),              // Buffer for out-of-order chunks / 无序块的缓冲区
            lastProcessedSeq: prevState.lastProcessedSeq ?? -1,  // Last successfully processed sequence / 最后成功处理的序列号
        }
        : {
            // Initialize fresh state / 初始化全新状态
            processedSeq: new Set<number>(),
            outputs: new Map<number, ContentItem | null>(),
            meta: {},
            error: null,
            buffer: new Map<number, ResponseChunk>(),
            lastProcessedSeq: -1,  // Start with -1, so first expected sequence is 0 / 从 -1 开始，因此第一个预期序列是 0
        };

    // Filter out chunks already processed in previous calls / 过滤掉之前调用中已处理的块
    const incoming: ResponseChunk[] = Array.isArray(chunks) ? chunks : [];
    const unprocessed = incoming.filter(c => {
        const seq = c?.sequence_number;
        return typeof seq !== 'number' || !state.processedSeq.has(seq);
    });

    // Add unprocessed chunks to buffer / 将未处理的块添加到缓冲区
    for (const chunk of unprocessed) {
        const seq = chunk?.sequence_number;
        if (typeof seq === 'number') {
            // Store chunk with its sequence number as key / 使用序列号作为键存储块
            state.buffer.set(seq, chunk);
        } else {
            // Handle chunks without sequence_number by assigning a decimal key
            // 通过分配小数键来处理没有 sequence_number 的块
            // 
            // Using +0.5 provides a temporary unique "sequence" for chunks without sequence_number.
            // This avoids key conflicts with existing integer sequence numbers.
            // 使用 +0.5 为没有 sequence_number 的块提供一个临时且唯一的"顺序"。
            // 这样可以避免与现有的整数序列号发生键冲突。
            // 
            // Why +0.5 instead of +1?
            // 为什么使用 +0.5 而不是 +1？
            // - Using lastProcessedSeq+1 could conflict with future sequence numbers
            //   使用 lastProcessedSeq+1 可能与未来的序列号冲突
            // - +0.5 allows insertion between sequences while guaranteeing uniqueness and monotonic increase
            //   +0.5 可以插入到序列之间，同时保证唯一性和单调递增
            state.buffer.set(state.lastProcessedSeq + 0.5, chunk);
        }
    }

    // Define the chunk processing function that handles different chunk types
    // 定义处理不同块类型的函数
    const processChunk = (chunk: ResponseChunk) => {
        switch (chunk.type) {
            // ========== Response Metadata / 响应元数据 ==========
            case 'response.created': {
                // Initialize response metadata (id, model, status, timestamp)
                // 初始化响应元数据（id、模型、状态、时间戳）
                const { response } = chunk;
                if (response) {
                    state.meta.id = response.id ?? state.meta.id;
                    state.meta.model = response.model ?? state.meta.model;
                    state.meta.status = response.status ?? state.meta.status;
                    state.meta.created_at = response.created_at ?? state.meta.created_at;
                }
                break;
            }
            
            // ========== Output Items / 输出项 ==========
            case 'response.output_item.added': {
                // Add a new output item placeholder / 添加新的输出项占位符
                // Deep clone to avoid modifying original chunk.item / 深拷贝以避免修改原始 chunk.item
                const outIdx = typeof chunk.output_index === 'number' ? chunk.output_index : 0;
                if (!state.outputs.has(outIdx)) {
                    state.outputs.set(outIdx, deepClone(chunk.item ?? {}));
                }
                break;
            }
            case 'response.output_item.done': {
                // Finalize an output item / 完成一个输出项
                // Deep clone to avoid modifying original item / 深拷贝以避免修改原始 item
                const { output_index, item } = chunk;
                state.outputs.set(output_index, deepClone(item));
                break;
            }
            
            // ========== Output Text / 输出文本 ==========
            case 'response.content_part.added':
            case 'response.content_part.done': {
                const { output_index, content_index, part } = chunk;
                const item = state.outputs.get(output_index) as OutputMessage;
                (item as OutputMessage).content = (item as OutputMessage).content ?? [];
                (item as OutputMessage).content[content_index] = deepClone(part);
                break;
            }
            case 'response.output_text.delta': {
                // Incrementally append text delta to the output / 增量追加文本增量到输出
                const { output_index, content_index, delta } = chunk;
                const item = state.outputs.get(output_index) as OutputMessage;
                (item as OutputMessage).content = (item as OutputMessage).content ?? [];
                (item.content[content_index] as OutputText) = (item.content[content_index] as OutputText) ?? { type: 'output_text', text: '' };
                (item.content[content_index] as OutputText).text = ((item.content[content_index] as OutputText).text ?? '') + (delta ?? '');
                break;
            }
            case 'response.output_text.done': {
                // Set final text content / 设置最终文本内容
                const { output_index, content_index, text } = chunk;
                const item = state.outputs.get(output_index) as OutputMessage;
                (item as OutputMessage).content = (item as OutputMessage).content ?? [];
                (item.content[content_index] as OutputText) = (item.content[content_index] as OutputText) ?? { type: 'output_text', text: '' };
                (item.content[content_index] as OutputText).text = text;
                break;
            }
            case 'response.output_text.annotation.added': {
                // Add annotation to text output / 向文本输出添加注释
                const { output_index, content_index, annotation_index, annotation } = chunk;
                const item = state.outputs.get(output_index) as OutputMessage;
                (item as OutputMessage).content = (item as OutputMessage).content ?? [];
                (item.content[content_index] as OutputText) = (item.content[content_index] as OutputText) ?? { type: 'output_text', text: '', annotations: [] };
                (item.content[content_index] as OutputText).annotations = (item.content[content_index] as OutputText).annotations ?? [];
                (item.content[content_index] as OutputText).annotations[annotation_index] = deepClone(annotation);
                break;
            }
            
            // ========== Refusal / 拒绝响应 ==========
            case 'response.refusal.delta': {
                const { output_index, content_index, delta } = chunk;
                const item = state.outputs.get(output_index) as OutputMessage;
                (item as OutputMessage).content = (item as OutputMessage).content ?? [];
                (item.content[content_index] as Refusal) = (item.content[content_index] as Refusal) ?? { type: 'refusal', refusal: '' };
                (item.content[content_index] as Refusal).refusal = ((item.content[content_index] as Refusal).refusal ?? '') + (delta ?? '');
                break;
            }
            case 'response.refusal.done': {
                const { output_index, content_index, refusal } = chunk;
                const item = state.outputs.get(output_index) as OutputMessage;
                (item as OutputMessage).content = (item as OutputMessage).content ?? [];
                (item.content[content_index] as Refusal) = (item.content[content_index] as Refusal) ?? { type: 'refusal', refusal: '' };
                (item.content[content_index] as Refusal).refusal = refusal;
                break;
            }
            // reasoning
            case 'response.reasoning_summary_part.added':
            case 'response.reasoning_summary_part.done': {
                const { output_index, summary_index, part } = chunk;
                const item = state.outputs.get(output_index) as Reasoning;
                (item as Reasoning).summary = (item as Reasoning).summary ?? [];
                (item as Reasoning).summary[summary_index] = deepClone(part) as any;
                break;
            }
            case 'response.reasoning_summary_text.delta': {
                const { output_index, summary_index, delta } = chunk;
                const item = state.outputs.get(output_index) as Reasoning;
                (item as Reasoning).summary = (item as Reasoning).summary ?? [];
                (item as Reasoning).summary[summary_index] = (item as Reasoning).summary[summary_index] ?? { type: 'reasoning', text: '' };
                (item as Reasoning).summary[summary_index].text = ((item as Reasoning).summary[summary_index].text ?? '') + (delta ?? '');
                break;
            }
            case 'response.reasoning_summary_text.done': {
                const { output_index, summary_index, text } = chunk;
                const item = state.outputs.get(output_index) as Reasoning;
                (item as Reasoning).summary = (item as Reasoning).summary ?? [];
                (item as Reasoning).summary[summary_index] = (item as Reasoning).summary[summary_index] ?? { type: 'reasoning', text: '' };
                (item as Reasoning).summary[summary_index].text = text;
                break;
            }
            case 'response.reasoning_text.delta': {
                const { output_index, content_index, delta } = chunk;
                const item = state.outputs.get(output_index) as Reasoning;
                (item as Reasoning).content = (item as Reasoning).content ?? [];
                (item as Reasoning).content[content_index] = (item as Reasoning).content[content_index] ?? { type: 'reasoning', text: '' };
                (item as Reasoning).content[content_index].text = ((item as Reasoning).content[content_index].text ?? '') + (delta ?? '');
                break;
            }
            case 'response.reasoning_text.done': {
                const { output_index, content_index, text } = chunk;
                const item = state.outputs.get(output_index) as Reasoning;
                (item as Reasoning).content = (item as Reasoning).content ?? [];
                (item as Reasoning).content[content_index] = (item as Reasoning).content[content_index] ?? { type: 'reasoning', text: '' };
                (item as Reasoning).content[content_index].text = text;
                break;
            }
            // function call
            case 'response.function_call_arguments.delta': {
                const { output_index, delta } = chunk;
                const item = state.outputs.get(output_index) as FunctionToolCall;
                (item as FunctionToolCall).arguments = ((item as FunctionToolCall).arguments ?? '') + (delta ?? '');
                break;
            }
            case 'response.function_call_arguments.done': {
                const { output_index, name } = chunk;
                const item = state.outputs.get(output_index) as FunctionToolCall;
                (item as FunctionToolCall).arguments = chunk.arguments;
                (item as FunctionToolCall).name = name;
                break;
            }
            // custom_tool_call
            case 'response.custom_tool_call_input.delta': {
                const { output_index, delta } = chunk;
                const item = state.outputs.get(output_index) as CustomToolCall;
                (item as CustomToolCall).input = ((item as CustomToolCall).input ?? '') + (delta ?? '');
                break;
            }
            case 'response.custom_tool_call_input.done': {
                const { output_index, input } = chunk;
                const item = state.outputs.get(output_index) as CustomToolCall;
                (item as CustomToolCall).input = input;
                break;
            }
            // mcp
            case 'response.mcp_call_arguments.delta': {
                const { output_index, delta } = chunk;
                const item = state.outputs.get(output_index) as MCPToolCall;
                (item as MCPToolCall).arguments = ((item as MCPToolCall).arguments ?? '') + (delta ?? '');
                break;
            }
            case 'response.mcp_call_arguments.done': {
                const { output_index } = chunk;
                const item = state.outputs.get(output_index) as MCPToolCall;
                (item as MCPToolCall).arguments = chunk.arguments;
                break;
            }
            case 'response.file_search_call.in_progress':
            case 'response.web_search_call.in_progress':
            case 'response.image_generation_call.in_progress':
            case 'response.mcp_call.in_progress':
            case 'response.mcp_list_tools.in_progress':
            case 'response.code_interpreter_call.in_progress': {
                const out = state.outputs.get(chunk.output_index) as any;
                if (out) out.status = 'in_progress';
                break;
            }
            case 'response.mcp_call.failed':
            case 'response.mcp_list_tools.failed': {
                const out = state.outputs.get(chunk.output_index) as any;
                if (out) out.status = 'failed';
                break;
            }
            case 'response.file_search_call.completed':
            case 'response.web_search_call.completed':
            case 'response.image_generation_call.completed':
            case 'response.mcp_call.completed':
            case 'response.mcp_list_tools.completed':
            case 'response.code_interpreter_call.completed': {
                const out = state.outputs.get(chunk.output_index) as any;
                if (out) out.status = 'completed';
                break;
            }
            case 'response.code_interpreter_call_code.delta': {
                const { output_index, delta } = chunk;
                const item = state.outputs.get(output_index) as CodeInterpreterCall;
                item.code = (item.code ?? '') + (delta ?? '');
                break;
            }
            case 'response.code_interpreter_call_code.done': {
                const { output_index, code } = chunk;
                const item = state.outputs.get(output_index) as CodeInterpreterCall;
                item.code = code;
                break;
            }
            case 'response.image_generation_call.partial_image': {
                const item = state.outputs.get(chunk.output_index) as ImageGenerationCall;
                if (item) item.result = (chunk as any).partial_image_b64;
                break;
            }
            case 'error': {
                state.error = {
                    code: chunk.code,
                    message: chunk.message,
                };
                break; 
            }
            case 'response.completed': {
                if ((chunk as any).response) {
                    state.meta.status = (chunk as any).response.status ?? 'completed';
                } else {
                    state.meta.status = 'completed';
                }
                break;
            }
            default: {
                // Ignore unsupported chunk types / 忽略不支持的块类型
                break;
            }
        }
    };

    // ==================== Sequential Processing / 顺序处理 ====================
    // Process chunks in sequential order from the buffer
    // Only chunks with consecutive sequence numbers are processed
    // 从缓冲区按顺序处理块
    // 只处理具有连续序列号的块
    
    let nextExpected = state.lastProcessedSeq + 1;  // Next sequence number we're waiting for / 我们等待的下一个序列号
    let processed = false;  // Flag to track if any chunk was processed in this iteration / 标记此次迭代中是否处理了任何块
    
    do {
        processed = false;
        const chunk = state.buffer.get(nextExpected);
        
        if (chunk) {
            // Found the next expected chunk, process it / 找到下一个预期的块，处理它
            processChunk(chunk);
            state.processedSeq.add(nextExpected);  // Mark as processed / 标记为已处理
            state.buffer.delete(nextExpected);     // Remove from buffer / 从缓冲区移除
            state.lastProcessedSeq = nextExpected; // Update last processed sequence / 更新最后处理的序列号
            nextExpected++;                        // Move to next expected sequence / 移动到下一个预期序列
            processed = true;                      // Continue the loop to check for more consecutive chunks / 继续循环检查更多连续块
        } else {
            // Check for chunks without sequence numbers (stored with decimal keys like N.5)
            // 检查没有序列号的块（使用小数键存储，如 N.5）
            const decimalKey = state.lastProcessedSeq + 0.5;
            const noSeqChunk = state.buffer.get(decimalKey);
            if (noSeqChunk) {
                processChunk(noSeqChunk);
                state.buffer.delete(decimalKey);
                state.lastProcessedSeq = nextExpected; // Update last processed sequence / 更新最后处理的序列号
                nextExpected++;                        // Move to next expected sequence / 移动到下一个预期序列
                processed = true;  // Continue to check for next integer sequence / 继续检查下一个整数序列
            }
        }
    } while (processed);  // Keep processing as long as we find consecutive chunks / 只要找到连续的块就继续处理

    // ==================== Tolerance Mechanism / 容错机制 ====================
    // Handle permanent missing chunks to prevent infinite waiting
    // If the gap between buffered chunks and last processed sequence exceeds MAX_GAP,
    // assume missing chunks won't arrive and continue processing remaining chunks
    // 处理永久缺失的块以防止无限等待
    // 如果缓冲块与最后处理序列之间的间隙超过 MAX_GAP，
    // 则假设缺失的块不会到达，继续处理剩余的块
    
    const MAX_GAP = 10;  // Maximum allowed gap before assuming chunks are permanently lost / 在假设块永久丢失之前允许的最大间隙
    
    // Extract all integer sequence numbers from buffer and sort them
    // 从缓冲区提取所有整数序列号并排序
    const bufferedSeqs = Array.from(state.buffer.keys())
        .filter((k): k is number => typeof k === 'number' && k === Math.floor(k))  // Only integer keys / 只要整数键
        .sort((a, b) => a - b);  // Sort in ascending order / 升序排序
    
    if (bufferedSeqs.length > MAX_GAP) {
        // Gap is too large, assume intermediate chunks are lost
        // Process all remaining buffered chunks in order
        // 间隙太大，假设中间的块已丢失
        // 按顺序处理所有剩余连续块
        let lastSeq = state.lastProcessedSeq;
        for (const seq of bufferedSeqs) {
            if (seq === lastSeq + 1) {
                const chunk = state.buffer.get(seq);
                if (chunk) {
                    processChunk(chunk);
                    state.processedSeq.add(seq);
                    state.buffer.delete(seq);
                    state.lastProcessedSeq = seq;
                    lastSeq = seq;
                }
            } else {
                break;
            }
        }
    }

    // ==================== Build Final Message / 构建最终消息 ====================
    const content = Array.from(state.outputs.values()).filter((item) => item !== null) as ContentItem[];
    
    // Extract and concatenate all text content for convenience
    // 提取并连接所有文本内容以便使用
    const output_text = content
        .filter((p: any) => p?.type === 'output_text')  // Only text items / 只要文本项
        .map((p: any) => p?.text ?? '')                 // Extract text / 提取文本
        .join('');                                       // Join into single string / 连接成单个字符串

    // Build the message object if we have any content or metadata
    // 如果有任何内容或元数据，则构建消息对象
    const message: Message | null = (content?.length || state.meta.id)
        ? {
            id: state.meta.id,
            role: "assistant",
            content,                                    // Array of content items / 内容项数组
            createdAt: state.meta.created_at,
            output_text,                                // Concatenated text for convenience / 连接的文本以便使用
            model: state.meta.model,
            status: state.meta.status ?? 'in_progress', // Default to in_progress if not set / 如果未设置则默认为 in_progress
            error: state.error ?? null,                 // Include error if any / 包含错误（如果有）
        }
        : null;

    return { message, nextState: state };
}

/**
 * Deep clone an object to avoid modifying original data
 * 深拷贝对象以避免修改原始数据
 * 
 * @param obj - Object to clone / 要克隆的对象
 * @returns Cloned object / 克隆的对象
 */
function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as unknown as T;
    }
    
    const cloned = {} as T;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}