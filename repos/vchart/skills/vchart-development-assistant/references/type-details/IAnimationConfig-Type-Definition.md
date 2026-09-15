## Overview

`IAnimationConfig` is a union type for VChart animation configurations, supporting two main animation paradigms:

```typescript
export type IAnimationConfig = IAnimationTimeline | IAnimationTypeConfig;
```

This type provides comprehensive animation control through either timeline-based orchestration or type-based configuration approaches.

## Base Structure

`IAnimationConfig` combines two distinct animation configuration approaches:

```typescript
type IAnimationConfig =
  | IAnimationTimeline // Timeline-based animation orchestration
  | IAnimationTypeConfig; // Type-based animation configuration

type IAnimationTypeConfig =
  | TypeAnimationConfig // Type-specific animation
  | ChannelAnimationConfig // Channel-based animation
  | CommonAnimationConfigItem; // Basic animation configuration
```

## Timeline Animation Configuration (IAnimationTimeline)

### Timeline Structure

```typescript
interface IAnimationTimeline {
  /** Timeline identifier for animation orchestration */
  id?: string;

  /** Time slices defining animation segments */
  timeSlices: IAnimationTimeSlice | IAnimationTimeSlice[];

  /** Animation start time (can be negative) */
  startTime?: GraphicFunctionValueType<number>;

  /** Total animation duration */
  totalTime?: GraphicFunctionValueType<number>;

  /** Sequential execution delay */
  oneByOne?: GraphicFunctionValueType<number | boolean>;

  /** Loop configuration: true (infinite) or positive integer (count) */
  loop?: GraphicFunctionValueType<number | boolean>;

  /** Element partitioner for timeline separation */
  partitioner?: GraphicFunctionCallback<boolean>;

  /** Element sorting within timeline */
  sort?: (datumA: any, datumB: any, graphicA: IGraphic, graphicB: IGraphic) => number;

  /** Animation execution control options */
  controlOptions?: IAnimationControlOptions;
}
```

### Time Slice Configuration

```typescript
interface IAnimationTimeSlice {
  /** Animation effects for this slice */
  effects: IAnimationEffect | IAnimationEffect[];

  /** Slice duration */
  duration?: GraphicFunctionValueType<number>;

  /** Delay before slice execution */
  delay?: GraphicFunctionValueType<number>;

  /** Delay after slice completion */
  delayAfter?: GraphicFunctionValueType<number>;
}
```

### Animation Effects

```typescript
interface IAnimationEffect {
  /** Animation type identifier */
  type?: string;

  /** Channel-based attribute animation */
  channel?: IAnimationChannelAttrs | string[];

  /** Custom animation interpolator or constructor */
  custom?: IAnimationChannelInterpolator | IAnimationCustomConstructor;

  /** Custom animation parameters */
  customParameters?: GraphicFunctionValueType<any>;

  /** Easing function type */
  easing?: EasingType;

  /** Animation effect options */
  options?: GraphicFunctionValueType<any>;
}
```

## Type-Based Animation Configuration (IAnimationTypeConfig)

### Type Animation Configuration

```typescript
interface TypeAnimationConfig extends CommonAnimationConfigItem {
  /** Animation type identifier */
  type: string;
}
```

### Channel Animation Configuration

```typescript
interface ChannelAnimationConfig extends CommonAnimationConfigItem {
  /** Channel attribute definitions */
  channel: IAnimationChannelAttrs | string[];
}
```

### Common Animation Configuration

```typescript
interface CommonAnimationConfigItem {
  /** Custom interpolator or animation constructor */
  custom?: IAnimationChannelInterpolator | IAnimationCustomConstructor;

  /** Custom animation parameters */
  customParameters?: GraphicFunctionValueType<any>;

  /** Easing function type */
  easing?: EasingType;

  /** Animation duration */
  duration?: GraphicFunctionValueType<number>;

  /** Animation start delay */
  delay?: GraphicFunctionValueType<number>;

  /** Delay after animation completion */
  delayAfter?: GraphicFunctionValueType<number>;

  /** Sequential execution configuration */
  oneByOne?: GraphicFunctionValueType<boolean | number>;

  /** Animation start time */
  startTime?: GraphicFunctionValueType<number>;

  /** Total animation time */
  totalTime?: GraphicFunctionValueType<number>;

  /** Loop configuration: true (infinite) or count */
  loop?: boolean | number;

  /** Animation effect options */
  options?: GraphicFunctionValueType<any>;

  /** Animation execution control options */
  controlOptions?: IAnimationControlOptions;

  /** Apply animation only to element itself, ignore children */
  selfOnly?: boolean;
}
```

## Channel Animation Configuration

### Channel Attributes

```typescript
type IAnimationChannelAttrs = Record<
  string,
  {
    /** Starting value or function */
    from?: any | IAnimationChannelFunction;

    /** Target value or function */
    to?: any | IAnimationChannelFunction;
  }
>;

type IAnimationChannelFunction = (datum: any, g: IGraphic, mark: IMark) => any;
```

## Animation Control Configuration

### Control Options

```typescript
interface IAnimationControlOptions {
  /** Clear animation when state changes */
  stopWhenStateChange?: boolean;

  /** Apply initial animation state immediately */
  immediatelyApply?: boolean;

  /** Ignore loop animation in final attribute calculation */
  ignoreLoopFinalAttributes?: boolean;
}
```

## Function Value Types

### Graphic Function Types

```typescript
type GraphicFunctionCallback<T> = (datum: any, g: IGraphic, params: any) => T;
type GraphicFunctionValueType<T> = GraphicFunctionCallback<T> | T;
```

### Animation Interpolator

```typescript
type IAnimationChannelInterpolator = (
  ratio: number,
  from: any,
  to: any,
  nextAttributes: any,
  datum: any,
  g: IGraphic,
  parameters: IAnimationParameters
) => boolean | void;
```

### Custom Animation Constructor

```typescript
interface IAnimationCustomConstructor {
  new (from: any, to: any, duration: number, ease: EasingType, parameters?: any): ACustomAnimate<any>;
}
```

## Animation Parameters

### Animation Context

```typescript
interface IAnimationParameters {
  width: number;
  height: number;
  mark: IMark;
  group: IMark | null;
  elementIndex: number;
  elementCount: number;
  view: any;
}
```

### Animation States

```typescript
enum AnimationStateEnum {
  appear = 'appear',
  disappear = 'disappear',
  enter = 'enter',
  update = 'update',
  state = 'state',
  exit = 'exit',
  normal = 'normal',
  none = 'none'
}

type IAnimationState = keyof typeof AnimationStateEnum;
```

## Mark Animation Specification

### Complete Mark Animation Configuration

```typescript
interface MarkAnimationSpec {
  /** Disappear animation */
  disappear?: IAnimationConfig | IAnimationConfig[];

  /** Appear animation */
  appear?: IAnimationConfig | IAnimationConfig[];

  /** Enter animation */
  enter?: IAnimationConfig | IAnimationConfig[];

  /** Exit animation */
  exit?: IAnimationConfig | IAnimationConfig[];

  /** Update animation */
  update?: IAnimationConfig | IAnimationConfig[];

  /** Normal state animation */
  normal?: IAnimationConfig | IAnimationConfig[];

  /** State transition animation */
  state?: IStateAnimationConfig;
}

type MarkAnimationType = keyof MarkAnimationSpec;
```

### State Animation Configuration

```typescript
interface IStateAnimationConfig {
  /** State animation duration */
  duration?: number;

  /** State animation easing function */
  easing?: EasingType;
}
```

## Dependency Type Definitions

### VRender Core Types

```typescript
// From @visactor/vrender-core
type EasingType = string; // Easing function identifiers

interface IGraphic {
  // VRender graphic element interface
}
```

### VRender Animate Types

```typescript
// From @visactor/vrender-animate
class ACustomAnimate<T> {
  // Custom animation class
}
```

### Mark Interface Types

```typescript
interface IMark {
  // VChart mark interface
}

interface IMarkGraphic {
  // Mark graphic interface
}
```
