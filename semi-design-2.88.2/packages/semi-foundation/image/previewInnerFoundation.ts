import { handlePrevent } from "../utils/a11y";
import BaseFoundation, { DefaultAdapter } from "../base/foundation";
import KeyCode from "../utils/keyCode";
import { getPreloadImagArr, downloadImage, isTargetEmit } from "./utils";
import { isUndefined, throttle } from "lodash";

export type RatioType = "adaptation" | "realSize";
export interface PreviewInnerAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getIsInGroup: () => boolean;
    notifyChange: (index: number, direction: string) => void;
    notifyZoom: (zoom: number, increase: boolean) => void;
    notifyClose: () => void;
    notifyVisibleChange: (visible: boolean) => void;
    notifyRatioChange: (type: RatioType) => void;
    notifyRotateChange: (angle: number) => void;
    notifyDownload: (src: string, index: number) => void;
    notifyDownloadError: (src: string) => void;
    registerKeyDownListener: () => void;
    unregisterKeyDownListener: () => void;
    disabledBodyScroll: () => void;
    enabledBodyScroll: () => void;
    getSetDownloadFunc: () => (src: string) => string;
    isValidTarget: (e: any) => boolean;
    changeImageZoom: (zoom: number, e?: WheelEvent) => void
}


const NOT_CLOSE_TARGETS = ["icon", "footer"];
const STOP_CLOSE_TARGET = ["icon", "footer", "header"];

export default class PreviewInnerFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<PreviewInnerAdapter<P, S>, P, S> {
    constructor(adapter: PreviewInnerAdapter<P, S>) {
        super({ ...adapter });
    }

    _timer = null;
    _startMouseDown = { x: 0, y: 0 };

    beforeShow() {
        this._adapter.registerKeyDownListener();
        this._adapter.disabledBodyScroll();
        this.updateTimer();
    }

    afterHide() {
        this._adapter.unregisterKeyDownListener();
        this._adapter.enabledBodyScroll();
        this.clearTimer();
    }

    handleViewVisibleChange = () => {
        const { viewerVisible } = this.getStates();
        if (viewerVisible) {
            this.setState({
                viewerVisible: false,
            } as any);
            this.clearTimer();
        }
    }

    handleMouseMove = (e) => {
        this._persistEvent(e);
        this.mouseMoveHandler(e);
    }
    
    mouseMoveHandler = throttle((e: any) => {
        const { viewerVisible } = this.getStates();
        const isValidTarget = this._adapter.isValidTarget(e);
        if (isValidTarget) {
            if (!viewerVisible) {
                this.setState({
                    viewerVisible: true,
                } as any);
            }
            this.updateTimer();
        } else {
            this.clearTimer();
        }
    }, 50);

    updateTimer = () => {
        const { viewerVisibleDelay } = this.getProps();
        this.clearTimer();
        this._timer = setTimeout(this.handleViewVisibleChange, viewerVisibleDelay);
    }

    clearTimer = () => {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    handleWheel = (e: WheelEvent) => {
        this.onWheel(e);
        handlePrevent(e);
    }

    onWheel = (e: WheelEvent): void => {
        const { zoomStep, maxZoom, minZoom } = this.getProps();
        const { zoom: currZoom } = this.getStates();
        let _zoom: number;
        if (e.deltaY < 0) {
            /* zoom in */
            if (currZoom + zoomStep <= maxZoom) {
                _zoom = Number((currZoom + zoomStep).toFixed(2));
            }
        } else if (e.deltaY > 0) {
            /* zoom out */
            if (currZoom - zoomStep >= minZoom) {
                _zoom = Number((currZoom - zoomStep).toFixed(2));
            }
        }
        if (!isUndefined(_zoom)) {
            this.handleZoomImage(_zoom, true, e);
        }
    };

    handleMouseUp = (e: any) => {
        const { maskClosable } = this.getProps();
        let couldClose = !isTargetEmit(e, NOT_CLOSE_TARGETS);
        const { clientX, clientY } = e;
        const { x, y } = this._startMouseDown;
        // 对鼠标移动做容错处理，当 x 和 y 方向在 mouseUp 的时候移动距离都小于等于 5px 时候就可以关闭预览
        // Error-tolerant processing of mouse movement, when the movement distance in the x and y directions is less than or equal to 5px in mouseUp, the preview can be closed
        // 不做容错处理的话，直接用 clientX !== x || y !== clientY 做判断，鼠标在用户点击时候无意识的轻微移动无法关闭预览，不符合用户预期
        // If you do not do fault-tolerant processing, but directly use clientX !== x || y !== clientY to make judgments, the slight movement of the mouse when the user clicks will not be able to close the preview, which does not meet the user's expectations.
        if (Math.abs(clientX - x) > 5 || Math.abs(y - clientY) > 5) {
            couldClose = false;
        }
        if (couldClose && maskClosable) {
            this._adapter.notifyVisibleChange(false);
        }
    }

    handleMouseDown = (e: any) => {
        const { clientX, clientY } = e;
        this._startMouseDown = { x: clientX, y: clientY } ;
    }

    handleKeyDown = (e: any) => {
        const { closeOnEsc } = this.getProps();
        if (closeOnEsc && e.keyCode === KeyCode.ESC) {
            e.stopPropagation();
            this._adapter.notifyVisibleChange(false);
            this._adapter.notifyClose();
            return;
        }
    }

    handleSwitchImage = (direction: string) => {
        const step = direction === "prev" ? -1 : 1;
        const { imgSrc, currentIndex: currentIndexInState } = this.getStates();
        const srcLength = imgSrc.length;
        const newIndex = (currentIndexInState + step + srcLength) % srcLength;
        if ("currentIndex" in this.getProps()) {
            if (this._adapter.getIsInGroup()) {
                const setCurrentIndex = this._adapter.getContext("setCurrentIndex");
                setCurrentIndex(newIndex);
            }
        } else {
            this.setState({
                currentIndex: newIndex,
            } as any);
        }
        this._adapter.notifyChange(newIndex, direction);
        this.setState({
            direction,
            rotation: 0,
        } as any);
    }

    handleDownload = () => {
        const { currentIndex, imgSrc } = this.getStates();
        const setDownloadName = this._adapter.getSetDownloadFunc();
        const downloadSrc = imgSrc[currentIndex];
        const downloadName = setDownloadName ? setDownloadName(downloadSrc) : downloadSrc.slice(downloadSrc.lastIndexOf("/") + 1).split('?')[0];
        downloadImage(downloadSrc, downloadName, this._adapter.notifyDownloadError);
        this._adapter.notifyDownload(downloadSrc, currentIndex);
    }

    handlePreviewClose = (e: any) => {
        this._adapter.notifyVisibleChange(false);
        this._adapter.notifyClose();
        handlePrevent(e);
    }

    handleAdjustRatio = (type: RatioType) => {
        this.setState({
            ratio: type,
        } as any);
        this._adapter.notifyRatioChange(type);
    }

    handleRotateImage = (direction: string) => {
        const { rotation } = this.getStates();
        const ROTATE_STEP = 90;
        const newRotation = rotation + (direction === "left" ? -ROTATE_STEP : ROTATE_STEP);
        
        this.setState({
            rotation: newRotation,
        } as any);
        this._adapter.notifyRotateChange(newRotation);
    }

    handleZoomImage = (newZoom: number, notify: boolean = true, e?: WheelEvent) => {
        const { zoom } = this.getStates();
        if (zoom !== newZoom) {
            notify && this._adapter.notifyZoom(newZoom, newZoom > zoom);
            
            this._adapter.changeImageZoom(newZoom, e);
            this.setState({
                zoom: newZoom,
            } as any);
        }
    }

    // 当 visible 改变之后，预览组件完成首张图片加载后，启动预加载
    // 如： 1，2，3，4，5，6，7，8张图片， 点击第 4 张图片，preLoadGap 为 2
    // 当 visible 从 false 变为 true ，首先加载第 4 张图片，当第 4 张图片加载完成后，
    // 再按照 5，3，6，2的顺序预先加载这几张图片
    // When visible changes, the preview component finishes loading the first image and starts preloading
    // Such as: 1, 2, 3, 4, 5, 6, 7, 8 pictures, click the 4th picture, preLoadGap is 2
    // When visible changes from false to true , load the 4th image first, when the 4th image is loaded,
    // Preload these pictures in the order of 5, 3, 6, 2
    preloadGapImage = () => {
        const { preLoad, preLoadGap, infinite, currentIndex } = this.getProps();

        const { imgSrc }= this.getStates();
        if (!preLoad || typeof preLoadGap !== "number" || preLoadGap < 1) {
            return;
        }

        const preloadImages = getPreloadImagArr(imgSrc, currentIndex, preLoadGap, infinite);
        if (preloadImages.length === 0) {
            return;
        }

        const Img = new Image();
        let index = 0;
        function callback(e: any) {
            index++;
            if (index < preloadImages.length) {
                Img.src = preloadImages[index];
            }
        }
        Img.onload = (e) => {
            this.setLoadSuccessStatus(Img.src);
            callback(e);
        };
        Img.onerror = callback;
        Img.src = preloadImages[0];
    }

    // 在切换左右图片时，当被切换图片完成加载后，根据方向决定下一个预加载的图片
    // 如： 1，2，3，4，5，6，7，8张图片
    // 当 preLoadGap 为 2， 从第 5 张图片进行切换
    // - 如果向 右 切换到第 6 张，则第 6 张图片加载动作结束后（无论加载成功 or 失败），会预先加载第 8 张；
    // - 如果向 左 切换到第 4 张，则第 4 张图片加载动作结束后（无论加载成功 or 失败），会预先加载第 2 张；
    // When switching the left and right pictures, when the switched picture is loaded, the next preloaded picture is determined according to the direction
    // Such as: 1, 2, 3, 4, 5, 6, 7, 8 pictures
    // When preLoadGap is 2, switch from the 5th picture
    // - If you switch to the 6th image(direction is next), the 8th image will be preloaded after the 6th image is loaded (whether it succeeds or fails to load);
    // - If you switch to the 4th image(direction is prev), the second image will be preloaded after the 4th image is loaded (whether it succeeds or fails to load);
    preloadSingleImage = () => {
        const { preLoad, preLoadGap, infinite } = this.getProps();
        const { imgSrc, currentIndex, direction, imgLoadStatus } = this.getStates();
        if (!preLoad || typeof preLoadGap !== "number" || preLoadGap < 1) {
            return;
        }
        // 根据方向决定preload那个index
        // Determine the index of preload according to the direction
        let preloadIndex = currentIndex + (direction === "prev" ? -1 : 1) * preLoadGap;
        if (preloadIndex < 0 || preloadIndex >= imgSrc.length) {
            if (infinite) {
                preloadIndex = (preloadIndex + imgSrc.length) % imgSrc.length;
            } else {
                return;
            }
        }
        // 如果图片没有加载成功过，则进行预加载
        // If the image has not been loaded successfully, preload it
        if (!imgLoadStatus[preloadIndex]) {
            const Img = new Image();
            Img.onload = (e) => {
                this.setLoadSuccessStatus(imgSrc[preloadIndex]);
            };
            Img.src = imgSrc[preloadIndex];
        }
    }

    setLoadSuccessStatus = (src: string) => {
        const { imgLoadStatus } = this.getStates();
        const status = { ...imgLoadStatus };
        status[src] = true;
        this.setState({
            imgLoadStatus: status,
        } as any);
    }

    onImageLoad = (src: string) => {
        const { preloadAfterVisibleChange } = this.getStates();
        this.setLoadSuccessStatus(src);
        // 当 preview 中当前加载的图片加载完成后，
        // 如果是在visible change之后的第一次加载，则启动加载该currentIndex左右preloadGap范围的图片
        // 如果是非第一次加载，是在左右切换图片，则根据方向预先加载单张图片
        // When the currently loaded image in Preview is loaded,
        // - It is the first load after visible change, start loading the images in the preloadGap range around the currentIndex
        // - It is not the first load, the image is switched left and right, and a single image is preloaded according to the direction
        if (preloadAfterVisibleChange) {
            this.preloadGapImage();
            this.setState({
                preloadAfterVisibleChange: false,
            } as any);
        } else {
            this.preloadSingleImage();
        }
    }
}
