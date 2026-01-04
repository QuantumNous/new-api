import { FormattingOptions } from 'jsonc-parser';
import { JsonWorker } from './jsonWorker';

let jsonWorker: JsonWorker | null = null;

self.onmessage = (e: MessageEvent) => {
    const { method, params, messageId } = e.data;

    if (method === 'init') {
        jsonWorker = new JsonWorker(params.value);
        self.postMessage({ messageId, result: 'Worker initialized' });
        return;
    }

    if (!jsonWorker) {
        self.postMessage({ messageId, error: 'Worker not initialized' });
        return;
    }

    let result;
    switch (method) {
        case 'updateModel':
            jsonWorker.updateModel(params.op);
            break;
        case 'undo':
            jsonWorker.undo();
            break;
        case 'redo':
            jsonWorker.redo();
            break;
        case 'format':
            result = jsonWorker.format(params.options as FormattingOptions);
            break;
        case 'foldRange':
            result = jsonWorker.foldRange();
            break;
        case 'validate':
            result = jsonWorker.validate();
            break;
        default:
            result = { error: 'Unknown method' };
    }

    self.postMessage({ messageId, result });
};
