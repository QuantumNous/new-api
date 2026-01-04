export default function shouldUseBezier(config: Record<string, any>) {
    return Boolean(config &&
        typeof config === 'object' &&
        (config.duration > 0 || typeof config.easing === 'string' || typeof config.easing === 'function'));
}
