/** Based on https://github.com/microsoft/vscode-json-languageservice with modifications for custom requirements */
export function runWhenGlobalIdle(callback: (idleDeadline: IdleDeadline) => void) {
    const handler = window.requestIdleCallback(callback);
    let disposed = false;

    return {
        dispose: () => {
            if (disposed) {
                return;
            }
            disposed = true;
            window.cancelIdleCallback(handler);
        },
    };
}
