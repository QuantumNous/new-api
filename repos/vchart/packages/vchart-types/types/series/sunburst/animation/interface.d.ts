export type SunburstMark = 'arc' | 'label';
export type SunburstAppearPreset = 'growAngle' | 'growRadius' | 'fadeIn';
export type SunburstAppearParams = 'growAngle' | 'growRadius' | 'fadeIn';
export interface ISunburstAnimationParams {
    animationInfo: () => animationInfo;
}
export type animationInfo = {
    startAngle: number;
    endAngle: number;
    outerRadius: number;
    innerRadius: number;
};
