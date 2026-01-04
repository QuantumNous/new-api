import BaseFoundation, { DefaultAdapter } from '../../base/foundation';
import { DEFAULT_SIZE, Size, NumberSize, Direction, NewSize, ResizeEventType } from "../types";
import { getStringSize, getNumberSize, has, calculateNewMax, findNextSnap, snap, clamp } from "../utils";
export interface ResizableHandlerAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    registerEvent: () => void;
    unregisterEvent: () => void
}

export class ResizableHandlerFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<ResizableHandlerAdapter<P, S>, P, S> {
    constructor(adapter: ResizableHandlerAdapter<P, S>) {
        super({ ...adapter });
    }

    init(): void {
        this._adapter.registerEvent();
    }

    onMouseDown = (e: MouseEvent) => {
        this.getProp('onResizeStart')(e, this.getProp('direction'), 'mouse');
    };

    onTouchStart = (e: TouchEvent) => {
        const touch = e.targetTouches[0];
        this.getProp('onResizeStart')(touch, this.getProp('direction'), 'touch');
    }

    destroy(): void {
        this._adapter.unregisterEvent();
    }
}

export interface ResizableAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getResizable: () => HTMLDivElement | null;
    registerEvent: (type: ResizeEventType) => void;
    unregisterEvent: (type: ResizeEventType) => void
}

export class ResizableFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<ResizableAdapter<P, S>, P, S> {
    constructor(adapter: ResizableAdapter<P, S>) {
        super({ ...adapter });
    }

    init(): void {
        if (!this.resizable || !this.window) {
            return;
        }
        const flexBasis = this.window.getComputedStyle(this.resizable).flexBasis;
        
        this.setState({
            width: this.propSize.width,
            height: this.propSize.height,
            flexBasis: flexBasis !== 'auto' ? flexBasis : undefined,
        } as any);

        this.onResizeStart = this.onResizeStart.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
    }

    flexDirection?: 'row' | 'column';
    type?: ResizeEventType;

    lockAspectRatio = 1;
    resizable: HTMLElement | null = null;

    parentLeft = 0;
    parentTop = 0;

    boundaryLeft = 0;
    boundaryRight = 0;
    boundaryTop = 0;
    boundaryBottom = 0;

    targetLeft = 0;
    targetTop = 0;

    get parent(): HTMLElement | null {
        if (!this.resizable) {
            return null;
        }
        return this.resizable.parentNode as HTMLElement;
    }

    get window(): Window | null {
        if (!this.resizable) {
            return null;
        }
        if (!this.resizable.ownerDocument) {
            return null;
        }
        return this.resizable.ownerDocument.defaultView as Window;
    }

    get propSize(): Size {
        const porps = this.getProps();
        return porps.size || porps.defaultSize || DEFAULT_SIZE;
    }

    get size(): NumberSize {
        let width = 0;
        let height = 0;
        if (this.resizable && this.window) {
            width = this.resizable.offsetWidth ;
            height = this.resizable.offsetHeight ;    
        }
        return { width, height };
    }

    get sizeStyle(): { width: string; height: string } {
        const size = this.getProp('size');
        const getSize = (property: 'width' | 'height'): string => {
            const value = this.getStates()[property];
            if (typeof value === 'undefined' || value === 'auto') {
                return 'auto';
            }
            const propSizeValue = this.propSize?.[property];

            if (propSizeValue?.toString().endsWith('%')) {
                if (value.toString().endsWith('%')) {
                    return value.toString();
                }

                const parentSize = this.getParentSize();
                const numberValue = Number(value.toString().replace('px', ''));
                const percentValue = (numberValue / parentSize[property]) * 100;

                return `${percentValue}%`;
            }

            return getStringSize(value);
        };

        const isResizing = this.getStates().isResizing;

        const width = size && typeof size.width !== 'undefined' && !isResizing
            ? getStringSize(size.width)
            : getSize('width');

        const height = size && typeof size.height !== 'undefined' && !isResizing
            ? getStringSize(size.height)
            : getSize('height');

        return { width, height };
    }

    getParentSize(): { width: number; height: number } {
        const appendPseudo = () => {
            if (!this.resizable || !this.window) {
                return null;
            }
            const parent = this.parent;
            if (!parent) {
                return null;
            }
            const pseudoEle = this.window.document.createElement('div');
            pseudoEle.style.width = '100%';
            pseudoEle.style.height = '100%';
            pseudoEle.style.position = 'absolute';
            pseudoEle.style.transform = 'scale(0, 0)';
            pseudoEle.style.left = '0';
            pseudoEle.style.flex = '0 0 100%';
            parent.appendChild(pseudoEle);
            return pseudoEle;
        };

        const removePseudo = (pseudo: HTMLElement) => {
            const parent = this.parent;
            if (!parent) {
                return;
            }
            parent.removeChild(pseudo);
        };
        if (!this.parent) {
            if (!this.window) {
                return { width: 0, height: 0 };
            }
            return { width: this.window.innerWidth, height: this.window.innerHeight };
        }
        const pseudoElement = appendPseudo();

        if (!pseudoElement) {
            return { width: 0, height: 0 };
        }

        let flexWrapChanged = false;
        const originalFlexWrap = this.parent.style.flexWrap;

        if (originalFlexWrap !== 'wrap') {
            flexWrapChanged = true;
            this.parent.style.flexWrap = 'wrap';
        }

        pseudoElement.style.position = 'relative';
        pseudoElement.style.minWidth = '100%';
        pseudoElement.style.minHeight = '100%';

        const size = {
            width: pseudoElement.offsetWidth,
            height: pseudoElement.offsetHeight,
        };

        if (flexWrapChanged) {
            this.parent.style.flexWrap = originalFlexWrap;
        }

        removePseudo(pseudoElement);
        return size;
    }

    registerEvents() {
        this._adapter.registerEvent(this.type);
    }

    unregisterEvents() {
        this._adapter.unregisterEvent(this.type);
    }

    getCssPropertySize(newSize: number | string, property: 'width' | 'height'): number | string {
        const propSizeValue = this.propSize?.[property];
        const state = this.getStates();

        const isAutoSize =
            state[property] === 'auto' &&
            state.original[property] === newSize &&
            (typeof propSizeValue === 'undefined' || propSizeValue === 'auto');

        return isAutoSize ? 'auto' : newSize;
    }


    calBoundaryMax(maxWidth?: number, maxHeight?: number) {
        const { boundsByDirection } = this.getProps();
        const { direction } = this.getStates();

        const isWidthConstrained = boundsByDirection && has('left', direction);
        const isHeightConstrained = boundsByDirection && has('top', direction);

        let maxWidthConstraint: number;
        let maxHeightConstraint: number;

        const props = this.getProps();

        if (props.boundElement === 'parent') {
            const parentElement = this.parent;
            if (parentElement) {
                maxWidthConstraint = isWidthConstrained
                    ? this.boundaryRight - this.parentLeft
                    : parentElement.offsetWidth + (this.parentLeft - this.boundaryLeft);

                maxHeightConstraint = isHeightConstrained
                    ? this.boundaryBottom - this.parentTop
                    : parentElement.offsetHeight + (this.parentTop - this.boundaryTop);
            }
        } else if (props.boundElement === 'window' && this.window) {
            maxWidthConstraint = isWidthConstrained
                ? this.boundaryRight
                : this.window.innerWidth - this.boundaryLeft;
            maxHeightConstraint = isHeightConstrained
                ? this.boundaryBottom
                : this.window.innerHeight - this.boundaryTop;
        } else if (props.boundElement) {
            const boundary = props.boundElement;

            maxWidthConstraint = isWidthConstrained
                ? this.boundaryRight - this.targetLeft
                : boundary.offsetWidth + (this.targetLeft - this.boundaryLeft);
            maxHeightConstraint = isHeightConstrained
                ? this.boundaryBottom - this.targetTop
                : boundary.offsetHeight + (this.targetTop - this.boundaryTop);
        }

        if (maxWidthConstraint && Number.isFinite(maxWidthConstraint)) {
            maxWidth = maxWidth && maxWidth < maxWidthConstraint ? maxWidth : maxWidthConstraint;
        }
        if (maxHeightConstraint && Number.isFinite(maxHeightConstraint)) {
            maxHeight = maxHeight && maxHeight < maxHeightConstraint ? maxHeight : maxHeightConstraint;
        }

        return { maxWidth, maxHeight };
    }

    calDirectionSize(clientX: number, clientY: number) {
        const props = this.getProps();
        const scale = props.scale || 1;
        let aspectRatio = props.ratio;
        const [resizeRatioX, resizeRatioY] = Array.isArray(aspectRatio) ? aspectRatio : [aspectRatio, aspectRatio];

        const { direction, original } = this.getStates();
        const { lockAspectRatio, lockAspectRatioExtraHeight = 0, lockAspectRatioExtraWidth = 0 } = props;

        let newWidth = original.width;
        let newHeight = original.height;

        const calculateNewWidth = (deltaX: number) => original.width + (deltaX * resizeRatioX) / scale;
        const calculateNewHeight = (deltaY: number) => original.height + (deltaY * resizeRatioY) / scale;

        if (has('top', direction)) {
            newHeight = calculateNewHeight(original.y - clientY);
            if (lockAspectRatio) {
                newWidth = (newHeight - lockAspectRatioExtraHeight) * this.lockAspectRatio + lockAspectRatioExtraWidth;
            }
        }
        if (has('bottom', direction)) {
            newHeight = calculateNewHeight(clientY - original.y);
            if (lockAspectRatio) {
                newWidth = (newHeight - lockAspectRatioExtraHeight) * this.lockAspectRatio + lockAspectRatioExtraWidth;
            }
        }
        if (has('right', direction)) {
            newWidth = calculateNewWidth(clientX - original.x);
            if (lockAspectRatio) {
                newHeight = (newWidth - lockAspectRatioExtraWidth) / this.lockAspectRatio + lockAspectRatioExtraHeight;
            }
        }
        if (has('left', direction)) {
            newWidth = calculateNewWidth(original.x - clientX);
            if (lockAspectRatio) {
                newHeight = (newWidth - lockAspectRatioExtraWidth) / this.lockAspectRatio + lockAspectRatioExtraHeight;
            }
        }

        return { newWidth, newHeight };
    }

    calAspectRatioSize(
        newWidth: number,
        newHeight: number,
        max: { width?: number; height?: number },
        min: { width?: number; height?: number },
    ) {
        const { lockAspectRatio, lockAspectRatioExtraHeight = 0, lockAspectRatioExtraWidth = 0 } = this.getProps();

        const minWidth = typeof min.width === 'undefined' ? 10 : min.width;
        const maxWidth = typeof max.width === 'undefined' || max.width < 0 ? newWidth : max.width;
        const minHeight = typeof min.height === 'undefined' ? 10 : min.height;
        const maxHeight = typeof max.height === 'undefined' || max.height < 0 ? newHeight : max.height;

        if (lockAspectRatio) {
            const adjustedMinWidth = (minHeight - lockAspectRatioExtraHeight) * this.lockAspectRatio + lockAspectRatioExtraWidth;
            const adjustedMaxWidth = (maxHeight - lockAspectRatioExtraHeight) * this.lockAspectRatio + lockAspectRatioExtraWidth;
            const adjustedMinHeight = (minWidth - lockAspectRatioExtraWidth) / this.lockAspectRatio + lockAspectRatioExtraHeight;
            const adjustedMaxHeight = (maxWidth - lockAspectRatioExtraWidth) / this.lockAspectRatio + lockAspectRatioExtraHeight;

            const lockedMinWidth = Math.max(minWidth, adjustedMinWidth);
            const lockedMaxWidth = Math.min(maxWidth, adjustedMaxWidth);
            const lockedMinHeight = Math.max(minHeight, adjustedMinHeight);
            const lockedMaxHeight = Math.min(maxHeight, adjustedMaxHeight);

            newWidth = clamp(newWidth, lockedMinWidth, lockedMaxWidth);
            newHeight = clamp(newHeight, lockedMinHeight, lockedMaxHeight);
        } else {
            newWidth = clamp(newWidth, minWidth, maxWidth);
            newHeight = clamp(newHeight, minHeight, maxHeight);
        }
        return { newWidth, newHeight };
    }

    setBoundary() {
        const props = this.getProps();

        // Set parent boundary
        if (props.boundElement === 'parent') {
            const parentElement = this.parent;
            if (parentElement) {
                const parentRect = parentElement.getBoundingClientRect();
                this.parentLeft = parentRect.left;
                this.parentTop = parentRect.top;
            }
        }

        // Set target (HTML element) boundary
        if (props.boundElement && typeof props.boundElement !== 'string') {
            const targetRect = props.boundElement.getBoundingClientRect();
            this.targetLeft = targetRect.left;
            this.targetTop = targetRect.top;
        }

        // Set resizable boundary
        if (this.resizable) {
            const { left, top, right, bottom } = this.resizable.getBoundingClientRect();
            this.boundaryLeft = left;
            this.boundaryRight = right;
            this.boundaryTop = top;
            this.boundaryBottom = bottom;
        }
    }


    onResizeStart = (e: MouseEvent, direction: Direction, type: ResizeEventType) => {
        this.type = type;
        this.resizable = this._adapter.getResizable();
        if (!this.resizable || !this.window) {
            return;
        }

        const { clientX, clientY } = e;
        const props = this.getProps();
        const states = this.getStates();

        // Call onResizeStart callback if defined
        if (props.onResizeStart) {
            const shouldContinue = props.onResizeStart(e, direction);
            if (shouldContinue === false) {
                return;
            }
        }

        // Update state with new size if defined
        const { size } = props;
        if (size) {
            const { height, width } = size;
            const { height: currentHeight, width: currentWidth } = states;

            if (height !== undefined && height !== currentHeight) {
                this.setState({ height } as any);
            }

            if (width !== undefined && width !== currentWidth) {
                this.setState({ width } as any);
            }
        }

        // Handle aspect ratio locking
        this.lockAspectRatio = typeof props.lockAspectRatio === 'number'
            ? props.lockAspectRatio
            : this.size.width / this.size.height;

        // Determine flexBasis if applicable
        let flexBasis: string | undefined;
        const computedStyle = this.window.getComputedStyle(this.resizable);
        if (computedStyle.flexBasis !== 'auto') {
            const parent = this.parent;
            if (parent) {
                const parentStyle = this.window.getComputedStyle(parent);
                this.flexDirection = parentStyle.flexDirection.startsWith('row') ? 'row' : 'column';
                flexBasis = computedStyle.flexBasis;
            }
        }

        // Set bounding rectangle and register events
        this.setBoundary();
        this.registerEvents();

        // Update state with initial resize values
        const state = {
            original: {
                x: clientX,
                y: clientY,
                width: this.size.width,
                height: this.size.height,
            },
            isResizing: true,
            backgroundStyle: {
                ...states.backgroundStyle,
                cursor: this.window.getComputedStyle(e.target as HTMLElement).cursor || 'auto',
            },
            direction,
            flexBasis,
        };

        this.setState(state as any);
    }


    onMouseMove = (event: MouseEvent) => {
        this.changePosition(event);
    }

    onTouchMove = (event: TouchEvent) => {
        event.preventDefault();
        const touch = event.targetTouches[0];
        this.changePosition(touch);
    }

    changePosition = (event: Touch | MouseEvent) => {
        const states = this.getStates();
        const props = this.getProps();

        if (!states.isResizing || !this.resizable || !this.window) {
            return;
        }

        const { clientX, clientY } = event;
        const { direction, original, width, height } = states;
        const parentSize = this.getParentSize();
        let { maxWidth, maxHeight, minWidth, minHeight } = props;

        // Calculate max and min dimensions
        const maxBounds = calculateNewMax(
            parentSize,
            this.window.innerWidth,
            this.window.innerHeight,
            maxWidth,
            maxHeight,
            minWidth,
            minHeight
        );

        maxWidth = maxBounds.maxWidth;
        maxHeight = maxBounds.maxHeight;
        minWidth = maxBounds.minWidth;
        minHeight = maxBounds.minHeight;

        // Calculate new size based on direction
        let { newWidth, newHeight }: NewSize = this.calDirectionSize(clientX, clientY);

        // Apply boundary constraints
        const boundaryMax = this.calBoundaryMax(maxWidth, maxHeight);
        newWidth = getNumberSize(newWidth, parentSize.width, this.window.innerWidth, this.window.innerHeight);
        newHeight = getNumberSize(newHeight, parentSize.height, this.window.innerWidth, this.window.innerHeight);

        // Apply snapping
        if (props.snap) {
            if (props.snap.x) {
                newWidth = findNextSnap(newWidth, props.snap.x, props.snapGap);
            }
            if (props.snap.y) {
                newHeight = findNextSnap(newHeight, props.snap.y, props.snapGap);
            }
        }

        // Adjust size based on aspect ratio
        const sizeFromAspectRatio = this.calAspectRatioSize(
            newWidth,
            newHeight,
            { width: boundaryMax.maxWidth, height: boundaryMax.maxHeight },
            { width: minWidth, height: minHeight }
        );
        newWidth = sizeFromAspectRatio.newWidth;
        newHeight = sizeFromAspectRatio.newHeight;

        // Apply grid snapping if defined
        if (props.grid) {
            const [gridW, gridH] = Array.isArray(props.grid) ? props.grid : [props.grid, props.grid];
            const gap = props.snapGap || 0;
            const newGridWidth = snap(newWidth, gridW);
            const newGridHeight = snap(newHeight, gridH);
            newWidth = gap === 0 || Math.abs(newGridWidth - newWidth) <= gap ? newGridWidth : newWidth;
            newHeight = gap === 0 || Math.abs(newGridHeight - newHeight) <= gap ? newGridHeight : newHeight;
        }

        // Convert width and height to CSS units if needed
        const convertToCssUnit = (size: number, originalSize: number, unit: string): string | number => {

            if (unit.endsWith('%')) {
                return `${(size / originalSize) * 100}%`;
            } else if (unit.endsWith('vw')) {
                return `${(size / this.window.innerWidth) * 100}vw`;
            } else if (unit.endsWith('vh')) {
                return `${(size / this.window.innerHeight) * 100}vh`;
            }
            return size;
        };

        if (typeof width === 'string') {
            newWidth = convertToCssUnit(newWidth, parentSize.width, width || '');
        }

        if (typeof height === 'string') {
            newHeight = convertToCssUnit(newHeight, parentSize.height, height || '');
        }

        // Create new state
        const newState: { width: string | number; height: string | number; flexBasis?: string | number } = {
            width: this.getCssPropertySize(newWidth, 'width'),
            height: this.getCssPropertySize(newHeight, 'height')
        };

        if (this.flexDirection === 'row') {
            newState.flexBasis = newState.width;
        } else if (this.flexDirection === 'column') {
            newState.flexBasis = newState.height;
        }

        // Check for changes
        const widthChanged = states.width !== newState.width;
        const heightChanged = states.height !== newState.height;
        const flexBaseChanged = states.flexBasis !== newState.flexBasis;
        const hasChanges = widthChanged || heightChanged || flexBaseChanged;

        if (hasChanges) {
            this.setState(newState as any);

            // Call onChange callback if defined
            if (props.onChange) {
                let newSize = {
                    width: newState.width,
                    height: newState.height
                };
                props.onChange(newSize, event, direction);
            }
            const size = props.size;
            if (size) {
                this.setState({
                    width: size.width ?? 'auto',
                    height: size.height ?? 'auto'
                } as any);
            }
        }
    }


    onMouseUp = (event: MouseEvent | TouchEvent) => {
        const { isResizing, direction, original } = this.getStates();

        if (!isResizing || !this.resizable) {
            return;
        }

        const { width: currentWidth, height: currentHeight } = this.size;
        const delta = {
            width: currentWidth - original.width,
            height: currentHeight - original.height,
        };

        const { onResizeEnd, size } = this.getProps();

        // Call onResizeEnd callback if defined
        if (onResizeEnd) {
            onResizeEnd(this.size, event, direction);
        }

        // Update state with new size if provided
        if (size) {
            this.setState({
                width: size.width ?? 'auto',
                height: size.height ?? 'auto'
            } as any);
        }

        // Unregister events and update state
        this.unregisterEvents();
        this.setState({
            isResizing: false,
            backgroundStyle: {
                ...this.getStates().backgroundStyle,
                cursor: 'auto'
            }
        } as any);
    }


    destroy(): void {
        this.unregisterEvents();
    }
}
