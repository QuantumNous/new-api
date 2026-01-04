import BaseFoundation, { DefaultAdapter } from "../base/foundation";

export interface PreviewImageAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getContainer: () => HTMLDivElement;
    getImage: () => HTMLImageElement;
    setLoading: (loading: boolean) => void;
    setImageCursor: (canDrag: boolean) => void
}

export interface DragDirection {
    canDragVertical: boolean;
    canDragHorizontal: boolean
}

export interface ExtremeTranslate {
    x: number;
    y: number
}

export interface Offset {
    x: number;
    y: number
}

export interface Translate {
    x: number;
    y: number
}

interface CalcBoundingRectMouseOffset {
    offset: Offset;
    width: number;
    height: number;
    rotation?: number
}

export interface BoundingRectSize {
    width: number;
    height: number
}

export default class PreviewImageFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<PreviewImageAdapter<P, S>, P, S> {
    constructor(adapter: PreviewImageAdapter<P, S>) {
        super({ ...adapter });
    }

    startMouseClientPosition = { x: 0, y: 0 };
    originImageWidth = null;
    originImageHeight = null;

    containerWidth = 0; 
    containerHeight = 0;

    init() {
        this._getContainerBoundingRectSize();
    }

    _isImageVertical = (): boolean => this.getProp("rotation") % 180 !== 0;

    _getContainerBoundingRectSize = () => {
        const containerDOM = this._adapter.getContainer();
        if (containerDOM) {
            this.containerWidth = containerDOM.clientWidth;
            this.containerHeight = containerDOM.clientHeight;
        }
    }

    _getAdaptationZoom = () => {
        let _zoom = 1;
        const containerDOM = this._adapter.getContainer();
        
        if (containerDOM && this.originImageWidth && this.originImageHeight) {
            const { rotation } = this.getProps();
            const { width: imageWidth, height: imageHeight } = this.calcBoundingRectSize(this.originImageWidth, this.originImageHeight, rotation);
            const reservedWidth = this.containerWidth - 80;
            const reservedHeight = this.containerHeight - 80;
            
            _zoom = Number(
                Math.min(reservedWidth / imageWidth, reservedHeight / imageHeight).toFixed(2)
            );
        }

        return _zoom;
    }

    _getInitialZoom = () => {
        const { ratio } = this.getProps();
        let _zoom = 1;

        if (ratio === 'adaptation') {
            _zoom = this._getAdaptationZoom();
        }

        return _zoom;
    }

    setLoading = (loading: boolean) => {
        this._adapter.setLoading(loading);
    }

    handleWindowResize = (): void => {
        this._getContainerBoundingRectSize();
        this.initializeImage();
    };

    handleLoad = (e: any): void => {
        if (e.target) {
            const { naturalWidth: w, naturalHeight: h } = e.target as any;
            this.originImageHeight = h;
            this.originImageWidth = w;
            this.setState({
                loading: false,
            } as any);
            // 图片初次加载，计算 zoom，zoom 改变不需要通过回调透出
            // When the image is loaded for the first time, zoom is calculated, and zoom changes do not need to be exposed through callbacks.
            this.initializeImage(false);
        }
        const { src, onLoad } = this.getProps();
        onLoad && onLoad(src);
    }

    handleError = (e: any): void => {
        const { onError, src } = this.getProps();
        this.setState({
            loading: false,
        } as any);
        onError && onError(src);
    }

    handleRatioChange = () => {
        this.initializeImage();
    }

    initializeImageZoom = (notify = true) => {
        const { currZoom } = this.getStates();
        const { onZoom } = this.getProps();
        
        const _zoom = this._getInitialZoom();
        
        if (currZoom !== _zoom) {
            onZoom(_zoom, notify);
        } else {
            this.changeZoom(_zoom);
        }
    }

    initializeTranslate = () => {
        this.setState({
            translate: {
                x: 0,
                y: 0
            }
        } as any);
    }

    initializeImage = (notify = true) => {
        this.initializeImageZoom(notify);
        this.initializeTranslate();
    }

    handleRightClickImage = (e: any) => {
        const { disableDownload } = this.getProps();
        if (disableDownload) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        } else {
            return true;
        }
    };

    calcBoundingRectSize(width = 0, height = 0, rotation = 0) {
        const angleInRadians = rotation * Math.PI / 180;
        const sinTheta = Math.abs(Math.sin(angleInRadians));
        const cosTheta = Math.abs(Math.cos(angleInRadians));
        const boundingWidth = width * cosTheta + height * sinTheta;
        const boundingHeight = width * sinTheta + height * cosTheta;

        return {
            width: boundingWidth,
            height: boundingHeight
        };
    }

    getCanDragDirection = (width: number, height: number): DragDirection => {
        let canDragHorizontal = width > this.containerWidth;
        let canDragVertical = height > this.containerHeight;

        return {
            canDragVertical,
            canDragHorizontal,
        };
    };

    changeZoom = (newZoom: number, e?: WheelEvent): void => {
        const imageDOM = this._adapter.getImage();
        const { currZoom, translate, width, height } = this.getStates();
        const { rotation } = this.getProps();
        const changeScale = newZoom / (currZoom || 1);
        const newWidth = Math.floor(this.originImageWidth * newZoom);
        const newHeight = Math.floor(this.originImageHeight * newZoom);
        let newTranslateX = Math.floor(translate.x * changeScale);
        let newTranslateY = Math.floor(translate.y * changeScale);

        const imageBound = this.calcBoundingRectSize(width, height, rotation);
        const newImageBound = {
            width: imageBound.width * changeScale,
            height: imageBound.height * changeScale
        };

        if (e && imageDOM && e.target === imageDOM) {
            let angle = rotation % 360;
            angle < 0 && (angle = 360 + angle);
            switch (angle) {
                case 0:
                    newTranslateX = (e.offsetX - 0.5 * width) * (1 - newZoom / currZoom) + translate.x;
                    newTranslateY = (e.offsetY - 0.5 * height) * (1 - newZoom / currZoom) + translate.y;
                    break;
                case 90:
                    newTranslateX = (0.5 * height - e.offsetY) * (1 - newZoom / currZoom) + translate.x;
                    newTranslateY = (e.offsetX - 0.5 * width) * (1 - newZoom / currZoom) + translate.y;
                    break;
                case 180:
                    newTranslateX = (0.5 * width - e.offsetX) * (1 - newZoom / currZoom) + translate.x;
                    newTranslateY = (0.5 * height - e.offsetY) * (1 - newZoom / currZoom) + translate.y;
                    break;
                case 270:
                    newTranslateX = (e.offsetY - 0.5 * height) * (1 - newZoom / currZoom) + translate.x; 
                    newTranslateY = (0.5 * width - e.offsetX ) * (1 - newZoom / currZoom) + translate.y;
                    break;
                default:
                    break;
            }
        }

        const newTranslate = this.getSafeTranslate(newImageBound.width, newImageBound.height, newTranslateX, newTranslateY);

        this.setState({
            translate: newTranslate,
            width: newWidth,
            height: newHeight,
            currZoom: newZoom,
        } as any);
        if (imageDOM) {
            const { canDragVertical, canDragHorizontal } = this.getCanDragDirection(newImageBound.width, newImageBound.height);
            const canDrag = canDragVertical || canDragHorizontal;

            this._adapter.setImageCursor(canDrag);
        }
    };

    getExtremeTranslate = (width: number, height: number): ExtremeTranslate => {
        return {
            x: (width - this.containerWidth) / 2,
            y: (height - this.containerHeight) / 2,
        };
    };

    getSafeTranslate = (width: number, height: number, translateX: number, translateY: number) => {
        const { x: extremeX, y: extremeY } = this.getExtremeTranslate(width, height);
        const { canDragVertical, canDragHorizontal } = this.getCanDragDirection(width, height);

        let newTranslateX = 0,
            newTranslateY = 0;

        if (canDragHorizontal) {
            newTranslateX = translateX > 0 ? Math.min(translateX, extremeX) : Math.max(translateX, -extremeX);
        }

        if (canDragVertical) {
            newTranslateY = translateY > 0 ? Math.min(translateY, extremeY) : Math.max(translateY, -extremeY);
        }

        return {
            x: newTranslateX,
            y: newTranslateY
        };
    }

    handleImageMove = (e: MouseEvent): void => {
        // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
        const mouseLeftPress = e.buttons === 1;

        if (mouseLeftPress) {
            this.moveImage(e);
        }
    };

    moveImage = (e: MouseEvent) => {
        const { clientX, clientY } = e;
        const { width, height, translate } = this.getStates();
        const { rotation } = this.getProps();
        const imageBound = this.calcBoundingRectSize(width, height, rotation);
        const { canDragVertical, canDragHorizontal } = this.getCanDragDirection(imageBound.width, imageBound.height);

        if (canDragVertical || canDragHorizontal) {
            let newTranslateX = canDragHorizontal ? translate.x + clientX - this.startMouseClientPosition.x : translate.x;
            let newTranslateY = canDragVertical ? translate.y + clientY - this.startMouseClientPosition.y : translate.y;
            
            const newTranslate = this.getSafeTranslate(imageBound.width, imageBound.height, newTranslateX, newTranslateY);

            this.setState({
                translate: newTranslate,
            } as any);

            this.startMouseClientPosition = {
                x: clientX,
                y: clientY
            };
        }
    };

    handleImageMouseDown = (e: any): void => {
        this.startMouseClientPosition = {
            x: e.clientX,
            y: e.clientY
        };
    };

    // 鼠标事件的 e.offset 是以 dom 旋转前左上角为零点的, 这个方法会转换为以旋转后元素的外接矩形左上角为零点的 offset
    calcBoundingRectMouseOffset = (calcBoundingRectMouseOffset: CalcBoundingRectMouseOffset) => {
        const {
            width,
            height,
            offset,
            rotation = 0
        } = calcBoundingRectMouseOffset;

        let degrees = rotation % 360;
        degrees = degrees >= 0 ? degrees : 360 + degrees;
        let boundOffsetX = 0,
            boundOffsetY = 0;

        switch (degrees) {
            case 0: 
                boundOffsetX = offset.x;
                boundOffsetY = offset.y;
                break;
            case 90: 
                boundOffsetX = height - offset.y;
                boundOffsetY = offset.x;
                break;
            case 180: 
                boundOffsetX = width - offset.x;
                boundOffsetY = height - offset.y;
                break;
            case 270:
                boundOffsetX = offset.y;
                boundOffsetY = width - offset.x;
                break;
            default:
                break;
        }

        return {
            x: boundOffsetX,
            y: boundOffsetY
        };
    }
}