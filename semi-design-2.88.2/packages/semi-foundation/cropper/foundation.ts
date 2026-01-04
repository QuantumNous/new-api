import BaseFoundation, { DefaultAdapter } from "../base/foundation";
import { getMiddle, getAspectHW } from "./utils";

export interface CropperAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getContainer: () => HTMLElement;
    notifyZoomChange: (zoom: number) => void;
    getImg: () => HTMLImageElement
}

interface Point {
    x: number;
    y: number
}

export interface ImageData {
    originalWidth: number;
    originalHeight: number;
    scale: number
}

export interface ImageDataState {
    width: number;
    height: number;
    centerPoint: Point
}

export interface CropperBox {
    width: number;
    height: number;
    centerPoint: Point
}

export interface ContainerData {
    width: number;
    height: number
}

export interface CropperBoxBorder {
    borderTop: number;
    borderLeft: number
}

export default class CropperFoundation <P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<CropperAdapter<P, S>, P, S> {
    imgData: ImageData;
    containerData: ContainerData;
    boxMoveDir: string;
    cropperBoxMoveStart: Point;
    imgMoveStart: Point;
    moveRange: {
        xMax: number;
        xMin: number;
        yMax: number;
        yMin: number
    };
    boxMoveParam: {
        paramX: number;
        paramY: number
    }
    cropperBox: CropperBoxBorder;
    rangeX: [number, number];
    rangeY: [number, number];
    initial: boolean;
    previewImg: HTMLImageElement;
    previewContainer: HTMLElement;
    previewContainerInitSize: {
        width: number;
        height: number
    };
    
    constructor(adapter: CropperAdapter<P, S>) {
        super({ ...adapter });

        this.containerData = {} as ContainerData;
        this.imgData = {} as ImageData;
        this.boxMoveDir = '';
        this.boxMoveParam = {
            paramX: 0,
            paramY: 0,
        };
        this.rangeX = null;
        this.rangeY = null;
        this.initial = false;
        this.previewImg = null;
        this.previewContainer = null;
    }

    init() {
        // 获取容器的宽高
        // get cropping Container 's width & height
        const container = this._adapter.getContainer();
        this.containerData.width = container.clientWidth;
        this.containerData.height = container.clientHeight;
        this.cropperBoxMoveStart = null;
    }

    destroy() {
        this.unBindMoveEvent();
        this.unBindResizeEvent();
        this.removePreview();
    }

    getImgDataWhenResize = (ratio: number) => {
        const { imgData } = this.getStates();
        const newImgData = {
            width: imgData.width * ratio,
            height: imgData.height * ratio,
            centerPoint: {
                x: imgData.centerPoint.x * ratio,
                y: imgData.centerPoint.y * ratio,
            }
        };
        this.imgData.scale *= ratio;
        return newImgData;
    }

    getCropperBoxWhenResize = (ratio: number, newContainerData: ContainerData) => {
        const { cropperBox } = this.getStates();
        const { aspectRatio } = this.getProps();
        const tempCropperBox = {
            width: cropperBox.width * ratio,
            height: cropperBox.height * ratio,
            centerPoint: {
                x: cropperBox.centerPoint.x * ratio,
                y: cropperBox.centerPoint.y * ratio,
            }
        };
        let xMin = tempCropperBox.centerPoint.x - tempCropperBox.width / 2;
        let xMax = tempCropperBox.centerPoint.x + tempCropperBox.width / 2;
        let yMin = tempCropperBox.centerPoint.y - tempCropperBox.height / 2;
        let yMax = tempCropperBox.centerPoint.y + tempCropperBox.height / 2;
        if (aspectRatio) {
            if (xMax > newContainerData.width) {
                xMax = newContainerData.width;
                xMin = tempCropperBox.width > newContainerData.width ? 
                    0 : newContainerData.width - tempCropperBox.width;
                tempCropperBox.width = xMax - xMin;
                tempCropperBox.height = tempCropperBox.width / aspectRatio;
                yMax = yMin + tempCropperBox.height;
            }
            if (yMax > newContainerData.height) {
                yMax = newContainerData.height;
                yMin = tempCropperBox.height > newContainerData.height ? 
                    0 : newContainerData.height - tempCropperBox.height;
                tempCropperBox.height = yMax - yMin;
                tempCropperBox.width = tempCropperBox.height * aspectRatio;
                xMax = xMin + tempCropperBox.width;
            }
        } else {
            if (xMax > newContainerData.width) {
                xMax = newContainerData.width;
                xMin = tempCropperBox.width > newContainerData.width ? 
                    0 : newContainerData.width - tempCropperBox.width;
            }
            if (yMax > newContainerData.height) {
                yMax = newContainerData.height;
                yMin = tempCropperBox.height > newContainerData.height ? 
                    0 : newContainerData.height - tempCropperBox.height;
            }
        }
        return {
            width: xMax - xMin,
            height: yMax - yMin,
            centerPoint: {
                x: (xMax + xMin) / 2,
                y: (yMax + yMin) / 2,
            }
        };
    }


    handleResize = () => {
        const { loaded } = this.getStates();
        if (!this.initial) {
            this.initial = true;
            return;
        }
        if (!loaded) {
            return;
        }
        const container = this._adapter.getContainer();
        const newContainerData = {
            width: container.clientWidth,
            height: container.clientHeight,
        };
        const ratio = newContainerData.width / this.containerData.width;
        const newImgData = this.getImgDataWhenResize(ratio);
        const newCropperBox = this.getCropperBoxWhenResize(ratio, newContainerData);
       
        this.containerData = newContainerData;
        this.setState({
            imgData: newImgData,
            cropperBox: newCropperBox,
        } as any);
    }

    handleImageLoad = (e: any) => {
        /**
         * 1. 图片加载完成后，获得图片的原始大小
         * 2. 计算图片的缩放比例，中心点位置
         */
        const { naturalWidth, naturalHeight } = e.target;
        const { width: containerWidth, height: containerHeight } = this.containerData;
        this.imgData.originalWidth = naturalWidth;
        this.imgData.originalHeight = naturalHeight;
        let scale = 1;
        const newImgDataState = {} as ImageDataState;
        /* 计算图片加载后的初始显示尺寸 */
        if (naturalWidth / containerWidth > naturalHeight / containerHeight) {
            scale = containerWidth / naturalWidth;
            newImgDataState.width = containerWidth;
            newImgDataState.height = naturalHeight * scale; 
        } else {
            scale = containerHeight / naturalHeight;
            newImgDataState.width = naturalWidth * scale;
            newImgDataState.height = containerHeight;
        }
        this.imgData.scale = scale;
        newImgDataState.centerPoint = {} as Point;
        newImgDataState.centerPoint.x = containerWidth / 2;
        newImgDataState.centerPoint.y = containerHeight / 2;
        /* 计算裁切框大小 */
        const newCropperBoxState = {} as CropperBox;
        const { defaultAspectRatio, aspectRatio } = this.getProps();
        const calcAspect = aspectRatio || defaultAspectRatio;
        if (containerWidth / containerHeight > calcAspect) {
            newCropperBoxState.width = containerHeight * calcAspect;
            newCropperBoxState.height = containerHeight;
        } else {
            newCropperBoxState.width = containerWidth;
            newCropperBoxState.height = containerWidth / calcAspect;
        }
        newCropperBoxState.centerPoint = {} as Point;
        newCropperBoxState.centerPoint.x = containerWidth / 2;
        newCropperBoxState.centerPoint.y = containerHeight / 2;
        this.setState({
            imgData: newImgDataState,
            cropperBox: newCropperBoxState,
            loaded: true,
        } as any);

        this.renderPreview();
    }

    renderPreview = () => {
        const { preview, src } = this.getProps();
        const previewNode = preview?.();
        if (!previewNode) {
            return;
        }
        const img = document.createElement('img');
        this.previewImg = img;
        this.previewContainer = previewNode;
        img.src = src;
        previewNode.appendChild(img);
        this.previewContainer.style.overflow = 'hidden';
        // 记录预览容器初始宽高
        const { width: previewWidth, height: previewHeight } = previewNode.getBoundingClientRect();
        this.previewContainerInitSize = {
            width: previewWidth,
            height: previewHeight,
        };
    }

    updatePreview = (props: {
        width: number;
        height: number;
        translateX: number;
        translateY: number;
        rotate: number
    }) => {
        if (!this.previewImg) {
            return;
        }
        const { cropperBox } = this.getStates();
        let zoom = 1;
        const { width: containerWidth, height: containerHeight } = this.previewContainerInitSize;
        let previewWidth = containerWidth;
        let previewHeight = containerHeight;
        if (previewWidth < previewHeight) {
            zoom = containerWidth / cropperBox.width;
            let tempHeight = zoom * cropperBox.height;
            if (tempHeight > containerHeight) {
                zoom = containerHeight / cropperBox.height;
                previewWidth = zoom * cropperBox.width;
            } else {
                previewHeight = tempHeight;
            }
        } else {
            zoom = containerHeight / cropperBox.height;
            let tempWidth = zoom * cropperBox.width;
            if (tempWidth > containerWidth) {
                zoom = containerWidth / cropperBox.width;
                previewHeight = zoom * cropperBox.height;
            } else {
                previewWidth = tempWidth;
            }
        }
        const { width, height, translateX, translateY, rotate } = props;
        // Set the image style
        this.previewImg.style.width = `${width * zoom}px`;
        this.previewImg.style.height = `${height * zoom}px`;
        this.previewImg.style.transform = `translate(${translateX * zoom}px, ${translateY * zoom}px) rotate(${rotate}deg)`;
        this.previewImg.style.transformOrigin = 'center';
        // set preview container size
        this.previewContainer.style.width = `${previewWidth}px`;
        this.previewContainer.style.height = `${previewHeight}px`;
    }

    removePreview = () => {
        if (this.previewImg && this.previewContainer) {
            this.previewContainer.removeChild(this.previewImg);
            this.previewImg = null;
        }
    }

    handleWheel = (e: any) => {
        // 防止双手缩放导致页面被放大
        e.preventDefault();
        const { imgData, zoom: currZoom } = this.getStates();
        const { maxZoom, minZoom, zoomStep } = this.getProps();

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
        if (_zoom === undefined) {
            return;
        }
        const boundingRect = e.currentTarget.getBoundingClientRect();
        const offsetX = e.clientX - boundingRect.left;
        const offsetY = e.clientY - boundingRect.top;
        const scaleCenter = {
            x: offsetX,
            y: - offsetY,
        };
        
        // 计算新的中心点位置
        const currentPoint = { ...imgData.centerPoint } as Point;
        currentPoint.y = - currentPoint.y;

        const newCenterPoint = {
            x: (currentPoint.x - scaleCenter.x) / currZoom * _zoom + scaleCenter.x,
            y: - [(currentPoint.y - scaleCenter.y) / currZoom * _zoom + scaleCenter.y],
        };

        const newWidth = imgData.width / currZoom * _zoom;
        const newHeight = imgData.height / currZoom * _zoom;
       
        const newImgDataState = {
            width: newWidth,
            height: newHeight,
            centerPoint: newCenterPoint
        };
        this.setState({
            imgData: newImgDataState,
            zoom: _zoom
        } as any);

        this._adapter.notifyZoomChange(_zoom);
    }

    getMoveParamByDir(dir: string) {
        let paramX = 0, paramY = 0;
        switch (dir) {
            case 'tl':
                paramX = -1; paramY = -1; break;
            case 'tm':
                paramY = -1; break;
            case 'tr':
                paramX = 1; paramY = -1; break;
            case 'ml':
                paramX = -1; break;
            case 'mr':
                paramX = 1; break;
            case 'bl':
                paramX = -1; paramY = 1; break;
            case 'bm':
                paramY = 1; break;
            case 'br':
                paramX = 1; paramY = 1; break;
            default:
                break; 
        }
        return {
            paramX,
            paramY
        };
    }

    getRangeForAspectChange = () => {
        const { cropperBox } = this.getStates();
        const { aspectRatio } = this.getProps();
        const { width: containerWidth, height: containerHeight } = this.containerData;
        // 可能的最大宽高
        let height: number, width: number;
        // 裁剪框当前的位置
        const xMin = cropperBox.centerPoint.x - cropperBox.width / 2;
        const xMax = cropperBox.centerPoint.x + cropperBox.width / 2;
        const yMin = cropperBox.centerPoint.y - cropperBox.height / 2;
        const yMax = cropperBox.centerPoint.y + cropperBox.height / 2;
        switch (this.boxMoveDir) {
            case 'tl':
                height = yMax;
                width = xMax;
                [width, height] = getAspectHW(width, height, aspectRatio);
                this.rangeX = [xMax - width, xMax];
                this.rangeY = [yMax - height, yMax];
                break;
            case 'tm':
                height = yMax;
                const leftHalfWidth = cropperBox.centerPoint.x;
                const rightHalfWidth = containerWidth - cropperBox.centerPoint.x;
                width = 2 * (leftHalfWidth < rightHalfWidth ? leftHalfWidth : rightHalfWidth);
                [width, height] = getAspectHW(width, height, aspectRatio);
                this.rangeX = [
                    cropperBox.centerPoint.x - width / 2, 
                    cropperBox.centerPoint.x + width / 2
                ];
                this.rangeY = [yMax - height, yMax];
                break;
            case 'tr':
                height = yMax;
                width = containerWidth - xMin;
                [width, height] = getAspectHW(width, height, aspectRatio);
                this.rangeX = [xMin, xMin + width];
                this.rangeY = [yMax - height, yMax];
                break;
            case 'ml':
                width = xMax;
                const topHalfHeight = cropperBox.centerPoint.y;
                const bottomHalfHeight = containerHeight - cropperBox.centerPoint.y;
                height = 2 * (topHalfHeight < bottomHalfHeight ? topHalfHeight : bottomHalfHeight);
                [width, height] = getAspectHW(width, height, aspectRatio);
                this.rangeX = [xMax - width, xMax];
                this.rangeY = [
                    cropperBox.centerPoint.y - height / 2, 
                    cropperBox.centerPoint.y + height / 2
                ];
                break;
            case 'mr':
                width = containerWidth - xMin;
                const topHalfHeight2 = cropperBox.centerPoint.y;
                const bottomHalfHeight2 = containerHeight - cropperBox.centerPoint.y;
                height = 2 * (topHalfHeight2 < bottomHalfHeight2 ? topHalfHeight2 : bottomHalfHeight2);
                [width, height] = getAspectHW(width, height, aspectRatio);
                this.rangeX = [xMin, xMin + width];
                this.rangeY = [
                    cropperBox.centerPoint.y - height / 2,
                    cropperBox.centerPoint.y + height / 2
                ];
                break;
            case 'bl':
                height = containerHeight - yMin;
                width = xMax;
                [width, height] = getAspectHW(width, height, aspectRatio);
                this.rangeX = [xMax - width, xMax];
                this.rangeY = [yMin, yMin + height];
                break;
            case 'bm':
                height = containerHeight - yMin;
                const leftHalfWidth2 = cropperBox.centerPoint.x;
                const rightHalfWidth2 = containerWidth - cropperBox.centerPoint.x;
                width = 2 * (leftHalfWidth2 < rightHalfWidth2 ? leftHalfWidth2 : rightHalfWidth2);
                [width, height] = getAspectHW(width, height, aspectRatio); 
                this.rangeX = [
                    cropperBox.centerPoint.x - width / 2,
                    cropperBox.centerPoint.x + width / 2,
                ];
                this.rangeY = [yMin, yMin + height]; 
                break;
            case 'br':
                height = containerHeight - yMin;
                width = containerWidth - xMin;
                [width, height] = getAspectHW(width, height, aspectRatio);
                this.rangeX = [xMin, xMin + width];
                this.rangeY = [yMin, yMin + height];
                break;
            default:
                break;
        }
    }

    handleCornerMouseDown = (e: any) => {
        const currentTarget = e.currentTarget;
        if (!currentTarget) {
            return;
        }
        e.preventDefault();
        const dir = currentTarget.dataset.dir;
        this.boxMoveDir = dir;
        this.boxMoveParam = this.getMoveParamByDir(dir);
        this.bindResizeEvent();
        const { aspectRatio } = this.getProps();
        if (aspectRatio) {
            this.getRangeForAspectChange();
        } else {
            this.rangeX = [0, this.containerData.width];
            this.rangeY = [0, this.containerData.height];
        }
        
    }

    bindResizeEvent = () => {
        const { aspectRatio } = this.getProps();
        document.addEventListener('mousemove', aspectRatio ? this.handleCornerAspectMouseMove : this.handleCornerMouseMove);
        document.addEventListener('mouseup', this.handleCornerMouseUp);
    }

    unBindResizeEvent = () => {
        const { aspectRatio } = this.getProps();
        document.removeEventListener('mousemove', aspectRatio ? this.handleCornerAspectMouseMove : this.handleCornerMouseMove);
        document.removeEventListener('mouseup', this.handleCornerMouseUp);
    }

    viewIMGDragStart = (e: any) => {
        e.preventDefault();
    }

    handleCornerAspectMouseMove = (e: any) => {
        e.preventDefault();
        const { clientX, clientY } = e;
        const { cropperBox } = this.getStates();
        const { aspectRatio } = this.getProps();
        const boundingRect = this._adapter.getContainer().getBoundingClientRect();
        const newCropperBoxPos = {
            width: cropperBox.width,
            height: cropperBox.height,
            centerPoint: { ...cropperBox.centerPoint }
        };
        let offsetX: number, offsetY: number;
        if (['ml', 'mr'].includes(this.boxMoveDir)) {
            offsetX = getMiddle(clientX - boundingRect.left, this.rangeX);
        } else {
            offsetY = getMiddle(clientY - boundingRect.top, this.rangeY);
        }
        switch (this.boxMoveDir) {
            case 'tl':
                newCropperBoxPos.height = this.rangeY[1] - offsetY;
                newCropperBoxPos.width = newCropperBoxPos.height * aspectRatio;
                newCropperBoxPos.centerPoint = {
                    x: this.rangeX[1] - newCropperBoxPos.width / 2,
                    y: this.rangeY[1] - newCropperBoxPos.height / 2,
                };
                break;
            case 'tm':
                newCropperBoxPos.height = this.rangeY[1] - offsetY;
                newCropperBoxPos.width = newCropperBoxPos.height * aspectRatio;
                newCropperBoxPos.centerPoint = {
                    x: cropperBox.centerPoint.x,
                    y: this.rangeY[1] - newCropperBoxPos.height / 2,
                };
                break;
            case 'tr':
                newCropperBoxPos.height = this.rangeY[1] - offsetY;
                newCropperBoxPos.width = newCropperBoxPos.height * aspectRatio;
                newCropperBoxPos.centerPoint = {
                    x: this.rangeX[0] + newCropperBoxPos.width / 2,
                    y: this.rangeY[1] - newCropperBoxPos.height / 2,
                };
                break;
            case 'ml':
                newCropperBoxPos.width = this.rangeX[1] - offsetX;
                newCropperBoxPos.height = newCropperBoxPos.width / aspectRatio;
                newCropperBoxPos.centerPoint = {
                    x: this.rangeX[1] - newCropperBoxPos.width / 2,
                    y: cropperBox.centerPoint.y,
                };
                break;
            case 'mr':
                newCropperBoxPos.width = offsetX - this.rangeX[0];
                newCropperBoxPos.height = newCropperBoxPos.width / aspectRatio;
                newCropperBoxPos.centerPoint = {
                    x: this.rangeX[0] + newCropperBoxPos.width / 2,
                    y: cropperBox.centerPoint.y,
                };
                break;
            case 'bl':
                newCropperBoxPos.height = offsetY - this.rangeY[0];
                newCropperBoxPos.width = newCropperBoxPos.height * aspectRatio;
                newCropperBoxPos.centerPoint = {
                    x: this.rangeX[1] - newCropperBoxPos.width / 2,
                    y: this.rangeY[0] + newCropperBoxPos.height / 2,
                };
                break;
            case 'bm':
                newCropperBoxPos.height = offsetY - this.rangeY[0];
                newCropperBoxPos.width = newCropperBoxPos.height * aspectRatio;
                newCropperBoxPos.centerPoint = {
                    x: cropperBox.centerPoint.x,
                    y: this.rangeY[0] + newCropperBoxPos.height / 2,
                };
                break;
            case 'br':
                newCropperBoxPos.height = offsetY - this.rangeY[0];
                newCropperBoxPos.width = newCropperBoxPos.height * aspectRatio;
                newCropperBoxPos.centerPoint = {
                    x: this.rangeX[0] + newCropperBoxPos.width / 2,
                    y: this.rangeY[0] + newCropperBoxPos.height / 2,
                };
                break;
            default:
                break;
        }
        if (newCropperBoxPos.height === 0 && newCropperBoxPos.width === 0) {
            this.changeDir();
            this.getRangeForAspectChange();
        } 
        this.setState({
            cropperBox: newCropperBoxPos
        } as any);
    }

    changeDir = () => {
        if (this.boxMoveDir.includes('t')) {
            this.boxMoveDir = this.boxMoveDir.replace('t', 'b');
        } else if (this.boxMoveDir.includes('b')) {
            this.boxMoveDir = this.boxMoveDir.replace('b', 't');
        }
        if (this.boxMoveDir.includes('l')) {
            this.boxMoveDir = this.boxMoveDir.replace('l', 'r');
        } else if (this.boxMoveDir.includes('r')) {
            this.boxMoveDir = this.boxMoveDir.replace('r', 'l');
        }
    }

    handleCornerMouseMove = (e: any) => {
        e.preventDefault();
        const { clientX, clientY } = e;
        const { cropperBox } = this.getStates();
        const boundingRect = this._adapter.getContainer().getBoundingClientRect();
        let offsetX = getMiddle(clientX - boundingRect.left, this.rangeX);
        let offsetY = getMiddle(clientY - boundingRect.top, this.rangeY);
        const newCropperBoxPos = {
            width: cropperBox.width,
            height: cropperBox.height,
            centerPoint: {
                x: cropperBox.centerPoint.x,
                y: cropperBox.centerPoint.y
            }
        };
        const { paramX, paramY } = this.boxMoveParam;
        let x: number, y: number;
        if (paramX) {
            x = cropperBox.centerPoint.x + paramX * cropperBox.width / 2;
            newCropperBoxPos.width = cropperBox.width + paramX * (offsetX - x);
            if (newCropperBoxPos.width < 0) {
                newCropperBoxPos.width = - newCropperBoxPos.width;
                this.boxMoveParam.paramX = -paramX;
            }
            newCropperBoxPos.centerPoint.x = offsetX - paramX * newCropperBoxPos.width / 2;
        }
        if (paramY) {
            y = cropperBox.centerPoint.y + paramY * cropperBox.height / 2;
            newCropperBoxPos.height = cropperBox.height + paramY * (offsetY - y);
            if (newCropperBoxPos.height < 0) {
                newCropperBoxPos.height = -newCropperBoxPos.height;
                this.boxMoveParam.paramY = -paramY;
            }
            newCropperBoxPos.centerPoint.y = offsetY - paramY * newCropperBoxPos.height / 2;
        }
        
        this.setState({
            cropperBox: newCropperBoxPos
        } as any);
    }

    handleCornerMouseUp = (e: any) => {
        this.boxMoveParam = { paramX: 0, paramY: 0 };
        this.unBindResizeEvent();
    }

    handleCropperBoxMouseDown = (e: any) => {
        const target = e.target;
        const { cropperBox } = this.getStates();
        const container = this._adapter.getContainer();
        const boundingRect = container.getBoundingClientRect();
        if (target.dataset.dir) {
            // 如果鼠标是落在了corner上，那么不做任何操作
            return;
        }
        // 移动裁切框
        this.cropperBoxMoveStart = {
            x: e.clientX,
            y: e.clientY
        };
        this.bindMoveEvent();
        // 计算 cropperBox 中心点移动范围
        this.moveRange = {
            xMin: cropperBox.width / 2,
            xMax: boundingRect.width - cropperBox.width / 2,
            yMin: cropperBox.height / 2,
            yMax: boundingRect.height - cropperBox.height / 2,
        };
    }

    bindMoveEvent = () => {
        document.addEventListener('mousemove', this.handleCropperBoxMouseMove);
        document.addEventListener('mouseup', this.handleCropperBoxMouseUp);
    }

    unBindMoveEvent = () => {
        document.removeEventListener('mousemove', this.handleCropperBoxMouseMove);
        document.removeEventListener('mouseup', this.handleCropperBoxMouseUp);
    }

    handleCropperBoxMouseMove = (e: any) => {
        if (!this.cropperBoxMoveStart) {
            return;
        }
        const { clientX, clientY } = e;
        const { cropperBox } = this.getStates();
        const offsetX = clientX - this.cropperBoxMoveStart.x;
        const offsetY = clientY - this.cropperBoxMoveStart.y;
        const newCenterPointX = getMiddle(cropperBox.centerPoint.x + offsetX, [this.moveRange.xMin, this.moveRange.xMax]);
        const newCenterPointY = getMiddle(cropperBox.centerPoint.y + offsetY, [this.moveRange.yMin, this.moveRange.yMax]);
        const newCropperBoxPos = {
            width: cropperBox.width,
            height: cropperBox.height,
            centerPoint: {
                x: newCenterPointX,
                y: newCenterPointY
            }
        };
        this.cropperBoxMoveStart = {
            x: clientX,
            y: clientY
        };
        this.setState({
            cropperBox: newCropperBoxPos
        } as any);
    }

    handleCropperBoxMouseUp = (e: any) => {
        if (!this.cropperBoxMoveStart) {
            return;
        }
        this.cropperBoxMoveStart = null;
        this.unBindMoveEvent();
    }

    handleMaskMouseDown = (e: any) => {
        if (e.currentTarget !== e.target) {
            return;
        }
        this.bindImgMoveEvent();
        // 记录开始移动的位置
        this.imgMoveStart = {
            x: e.clientX,
            y: e.clientY
        };
    }

    bindImgMoveEvent = () => {
        document.addEventListener('mousemove', this.handleImgMove);
        document.addEventListener('mouseup', this.handleImgMoveUp);
    }

    unBindImgMoveEvent = () => {
        document.removeEventListener('mousemove', this.handleImgMove);
        document.removeEventListener('mouseup', this.handleImgMoveUp);
    }

    handleImgMove = (e: any) => {
        if (!this.imgMoveStart) {
            return;
        }
        const { clientX, clientY } = e;
        const { imgData } = this.getStates();
        const offsetX = clientX - this.imgMoveStart.x;
        const offsetY = clientY - this.imgMoveStart.y;
        const newCenterPointX = imgData.centerPoint.x + offsetX;
        const newCenterPointY = imgData.centerPoint.y + offsetY;
        const newImgData = {
            width: imgData.width,
            height: imgData.height,
            centerPoint: {
                x: newCenterPointX,
                y: newCenterPointY
            }
        };
        this.imgMoveStart = {
            x: clientX,
            y: clientY
        };
        this.setState({
            imgData: newImgData
        } as any);
    }

    handleImgMoveUp = (e: any) => {
        if (!this.imgMoveStart) {
            return;
        }
        this.imgMoveStart = null;
        this.unBindImgMoveEvent();
    }

    getCropperCanvas = () => {
        const { cropperBox, imgData, rotate, zoom } = this.getStates();
        const { fill } = this.getProps();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = this._adapter.getImg();

        // 计算包含旋转后的图片的矩形容器的宽高
        const angle = rotate * Math.PI / 180;
        const sine = Math.abs(Math.sin(angle));
        const cosine = Math.abs(Math.cos(angle));
        const imgWidth = this.imgData.originalWidth;
        const imgHeight = this.imgData.originalHeight;
        const containerWidth = imgWidth * cosine + imgHeight * sine;
        const containerHeight = imgHeight * cosine + imgWidth * sine;

        // 判断裁切区域和外接矩形是否存在交集，如果不存在，则直接返回空白图片
        // 计算需要裁剪的区域实际大小和位置
        const cropperContainerWidth = containerWidth * zoom * this.imgData.scale;
        const cropperContainerHeight = containerHeight * zoom * this.imgData.scale;
        const cropperContainerTop = imgData.centerPoint.y - cropperContainerHeight / 2;
        const cropperContainerLeft = imgData.centerPoint.x - cropperContainerWidth / 2;
        const cropperBoxLeft = cropperBox.centerPoint.x - cropperBox.width / 2;
        const cropperBoxTop = cropperBox.centerPoint.y - cropperBox.height / 2;
        const realZoom = zoom * this.imgData.scale;
        
        const relativeCropLeft = (cropperBoxLeft - cropperContainerLeft) / realZoom;
        const relativeCropTop = (cropperBoxTop - cropperContainerTop) / realZoom;
        const relativeWidth = cropperBox.width / realZoom;
        const relativeHeight = cropperBox.height / realZoom;
        const relativeCropRight = relativeCropLeft + relativeWidth;
        const relativeCropBottom = relativeCropTop + relativeHeight;

        if (relativeCropRight < 0 || relativeCropBottom < 0 || relativeCropLeft > containerWidth || relativeCropTop > containerHeight) {
            // 没有交集，直接返回空白图片
            const emptyCanvas = document.createElement('canvas');
            const ctx = emptyCanvas.getContext('2d');
            emptyCanvas.width = relativeWidth;
            emptyCanvas.height = relativeHeight;
            ctx.fillStyle = fill;
            ctx.fillRect(0, 0, relativeWidth, relativeHeight);
            return emptyCanvas;
        }

        canvas.width = containerWidth;
        canvas.height = containerHeight;
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, containerWidth, containerHeight);

        const halfWidth = containerWidth / 2;
        const halfHeight = containerHeight / 2;
        ctx.translate(halfWidth, halfHeight);
        ctx.rotate(rotate * Math.PI / 180);
        ctx.translate(-halfWidth, -halfHeight);

        const imgX = (containerWidth - imgWidth) / 2;
        const imgY = (containerHeight - imgHeight) / 2;
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight, imgX, imgY, imgWidth, imgHeight);

        const canvas2 = document.createElement('canvas');
        const ctx2 = canvas2.getContext('2d');
        // 为了避免裁剪时候，超出被裁切的画布的部分颜色不正常，需要将裁切区域限制在画布范围内。
        // 相对位置会在后续进行修正
        let realLeft = relativeCropLeft;
        let realTop = relativeCropTop;
        let realWidth = relativeWidth;
        let realHeight = relativeHeight;
       
        if (relativeCropLeft < 0) {
            realLeft = 0;
        }
        if (relativeCropTop < 0) {
            realTop = 0;
        }
        if (relativeCropRight > containerWidth) {
            realWidth = containerWidth - realLeft;
        } else if (relativeCropLeft < 0) {
            realWidth = relativeCropRight;
        }

        if (relativeCropBottom > containerHeight) {
            realHeight = containerHeight - realTop;
        } else if (relativeCropTop < 0) {
            realHeight = relativeCropBottom;
        }

        const imgDataResult = ctx.getImageData(realLeft, realTop, realWidth, realHeight);
        canvas2.width = relativeWidth;
        canvas2.height = relativeHeight;
        ctx2.fillStyle = fill;
        ctx2.fillRect(0, 0, relativeWidth, relativeHeight);
        ctx2.putImageData(
            imgDataResult, 
            relativeCropLeft < 0 ? - relativeCropLeft : 0,  
            relativeCropTop < 0 ? - relativeCropTop : 0,
        );
        return canvas2;
    }
}