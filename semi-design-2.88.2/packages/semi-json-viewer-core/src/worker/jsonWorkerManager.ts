import { IModelContentChangeEvent } from '../common/emitterEvents';
import { FormattingOptions } from 'jsonc-parser';
import { getCurrentNameSpaceId } from '../common/nameSpace';

//TODO 修改封装方式

/**
 * JsonWorkerManager 类用于管理 JSON Worker
 */

type WorkerService = {
    init: { value: string };
    updateModel: {
        op: IModelContentChangeEvent | IModelContentChangeEvent[]
    };
    format: { options: FormattingOptions };
    foldRange: Record<string, never>;
    validate: Record<string, never>;
    undo: Record<string, never>;
    redo: Record<string, never>
};

const workerManagerMap = new Map<string, JsonWorkerManager>();

export class JsonWorkerManager {
    private _worker: Worker;
    private _callbacks: Map<number, (result: any) => void>;

    constructor() {
        const workerRaw = decodeURIComponent(`%WORKER_RAW%`);
        const blob = new Blob([workerRaw], { type: 'application/javascript' });
        const workerURL = URL.createObjectURL(blob);
        this._worker = new Worker(workerURL);
        this._callbacks = new Map();

        this._worker.onmessage = this._handleWorkerMessage.bind(this);
    }

    async init(value: string) {
        await this._sendRequest('init', { value });
    }

    updateModel(op: IModelContentChangeEvent | IModelContentChangeEvent[]) {
        return this._sendRequest('updateModel', { op });
    }

    undo() {
        return this._sendRequest('undo', {});
    }

    redo() {
        return this._sendRequest('redo', {});
    }

    formatJson(options: FormattingOptions) {
        return this._sendRequest('format', { options });
    }

    foldRange() {
        return this._sendRequest('foldRange', {});
    }

    validate() {
        return this._sendRequest('validate', {});
    }

    private _sendRequest<T extends keyof WorkerService>(method: T, params: WorkerService[T]): Promise<any> {
        return new Promise((resolve, reject) => {
            const messageId = Date.now() + Math.random();
            this._callbacks.set(messageId, resolve);
            this._worker.postMessage({ messageId, method, params });
        });
    }

    private _handleWorkerMessage(event: MessageEvent) {
        const { messageId, result, error } = event.data;
        const callback = this._callbacks.get(messageId);
        if (callback) {
            if (error) {
                callback(new Error(error));
            } else {
                callback(result);
            }
            this._callbacks.delete(messageId);
        }
    }

    public dispose() {
        this._worker.terminate();
        this._callbacks.clear();
    }
}

export function getJsonWorkerManager() {
    const currentNameSpaceId = getCurrentNameSpaceId();
    if (!currentNameSpaceId) {
        throw new Error('No active worker ID set');
    }

    let workerManager = workerManagerMap.get(currentNameSpaceId);
    if (!workerManager) {
        workerManager = new JsonWorkerManager();
        workerManagerMap.set(currentNameSpaceId, workerManager);
    }
    return workerManager;
}

export function disposeWorkerManager(id: string) {
    const workerManager = workerManagerMap.get(id);
    if (workerManager) {
        workerManagerMap.delete(id);
        workerManager.dispose();
    }
}
