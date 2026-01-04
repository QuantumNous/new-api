import getEasing from './getEasing';
import presets, { PresetsItem } from './presets';
import shouldUseBezier from './shouldUseBezier';

export interface Value {
    easing: string;
    duration: number | string
}

export interface DefaultConfig extends PresetsItem {
    precision: number
}

export interface Config {
    easing?: string;
    duration?: number | string;
    delay?: string
}

export interface Wrapped extends DefaultConfig, Config {
    done: boolean;
    val?: Value
}

const defaultConfig: DefaultConfig = {
    ...presets.default,
    precision: 0.01,
};

export default function wrapValue(val: Value, config: Config = {}) {
    if (shouldUseBezier(config)) {
        const easing = getEasing(config.easing);
        const duration = typeof config.duration === 'number' && config.duration > 0 ? config.duration : 1000;
        config = { ...config, easing, duration };
    }

    let wrapped: Wrapped = { ...defaultConfig, ...config, done: false };

    if (val && typeof val === 'object' && 'val' in val) {
        if (shouldUseBezier(val)) {
            const easing = getEasing(val.easing);
            const duration = typeof val.duration === 'number' && val.duration > 0 ?
                val.duration :
                parseInt(config.duration as string) || 1000;
            val = { ...val, easing, duration };
        }
        wrapped = { ...wrapped, ...val };
    } else {
        wrapped = { ...wrapped, val };
    }
    return wrapped;
}
