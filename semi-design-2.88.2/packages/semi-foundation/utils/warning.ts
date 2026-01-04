export default function warning(flag: boolean, info: string) {
    if (flag) {
        console.warn(`Warning: ${info}`);
    }
}
