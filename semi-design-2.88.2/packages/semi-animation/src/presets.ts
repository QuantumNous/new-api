/**
 * stiffness is like tension
 * damping is like friction
 */


export interface PresetsItem {
    tension: number;
    friction: number
}
export interface Presets {
    default: PresetsItem;
    gentle: PresetsItem;
    wobbly: PresetsItem;
    stiff: PresetsItem;
    slow: PresetsItem;
    molasses: PresetsItem
}
export default {
    default: { tension: 170, friction: 26 }, // the default, if nothing provided
    gentle: { tension: 120, friction: 14 },
    wobbly: { tension: 180, friction: 12 },
    stiff: { tension: 210, friction: 20 },
    slow: { tension: 280, friction: 60 },
    molasses: { tension: 280, friction: 120 },
} as Presets;
