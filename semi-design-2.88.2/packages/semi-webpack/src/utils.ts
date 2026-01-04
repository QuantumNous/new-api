import os from 'os';

export function transformPath(path: string): string {
    if (os.platform() === 'win32') {
        return path.replace(/[\\]+/g, '/');
    }
    return path;
}