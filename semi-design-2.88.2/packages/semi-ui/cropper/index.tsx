import React from 'react';
import BaseComponent from '../_base/baseComponent';
import cls from "classnames";
import PropTypes from 'prop-types';
import "@douyinfe/semi-foundation/cropper/cropper.scss";
import CropperFoundation, { CropperAdapter, ImageDataState, CropperBox } from '@douyinfe/semi-foundation/cropper/foundation';
import { cssClasses, strings } from '@douyinfe/semi-foundation/cropper/constants';
import ResizeObserver, { ObserverProperty } from '../resizeObserver';
import { isUndefined } from 'lodash';

interface CropperProps {
    className?: string;
    style?: React.CSSProperties;
    /* The address of the image that needs to be cropped */
    src?: string;
    /* Parameters that need to be transparently transmitted to the img node */
    imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
    /* The shape to crop, defaults to rectangle */
    shape?: 'rect' | 'round' | 'roundRect';
    /* Controlled crop ratio */
    aspectRatio?: number;
    /* The initial width-to-height ratio of the cropping box, default is 1 */
    defaultAspectRatio?: number;
    /* controlled scaling */
    /* when img loaded，After the image is loaded, an initial layer of scaling 
        will be performed on the image to fit the zoom area.
        The zoom parameter is to zoom based on the initial zoom.
    */
    zoom?: number;
    onZoomChange?: (zoom: number) => void;
    /* Image rotation angle */
    rotate?: number;
    /* Show crop box resizing box ?*/
    showResizeBox?: boolean;
    cropperBoxStyle?: React.CSSProperties;
    cropperBoxCls?: string;
    /* The fill color of the non-picture parts in the cut result */
    fill?: string;
    maxZoom?: number;
    minZoom?: number;
    zoomStep?: number;
    preview?: () => HTMLElement
}

interface CropperState {
    imgData: ImageDataState;
    cropperBox: CropperBox;
    zoom: number;
    rotate: number;
    loaded: boolean
}

const prefixCls = cssClasses.PREFIX;

class Cropper extends BaseComponent<CropperProps, CropperState> {

    static __SemiComponentName__ = "Cropper";

    static propTypes = {
        className: PropTypes.string,
        style: PropTypes.object,
        
    };

    static defaultProps = {
        shape: 'rect',
        defaultAspectRatio: 1,
        showResizeBox: true,
        fill: 'rgba(0, 0, 0, 0)',
        maxZoom: 3,
        minZoom: 0.1,
        zoomStep: 0.1,
    }

    containerRef: HTMLDivElement;
    imgRef: React.RefObject<HTMLImageElement>;
    foundation: CropperFoundation;

    constructor(props: CropperProps) {
        super(props);
    
        this.state = {
            imgData: {
                width: 0,
                height: 0,
                centerPoint: {
                    x: 0,
                    y: 0
                }
            },
            cropperBox: {
                width: 0,
                height: 0,
                centerPoint: {
                    x: 0,
                    y: 0,
                }
            },
            zoom: 1,
            rotate: 0,
            loaded: false,
        };
        this.foundation = new CropperFoundation(this.adapter);
        this.imgRef = React.createRef();
    }

    get adapter(): CropperAdapter<CropperProps, CropperState> {
        return {
            ...super.adapter,
            getContainer: () => this.containerRef as unknown as HTMLElement,
            notifyZoomChange: (zoom: number) => {
                const { onZoomChange } = this.props;
                onZoomChange?.(zoom);
            },
            getImg: () => this.imgRef.current,
        };
    }

    static getDerivedStateFromProps(nextProps: CropperProps, prevState: CropperState) {  
        const { rotate: newRotate, zoom: newZoom } = nextProps;
        const { rotate, zoom, imgData, cropperBox, loaded } = prevState;
        let nextWidth = imgData.width, nextHeight = imgData.height;
        let nextImgCenter = { ...imgData.centerPoint };
        const nextState = {} as any;
        if (!loaded) {
            return null;
        }
        if (!isUndefined(newRotate) && newRotate !== rotate) {
            nextState.rotate = newRotate;
            if (loaded) {
                // 因为以裁切框的左上方顶点作为原点，所以centerPoint 的 y 坐标与实际的坐标系方向相反，
                // 因此 y 方向需要先做变换，再使用旋转变换公式计算中心点坐标
                const rotateCenter = {
                    x: cropperBox.centerPoint.x,
                    y: - cropperBox.centerPoint.y
                };
                const imgCenter = {
                    x: imgData.centerPoint.x,
                    y: - imgData.centerPoint.y
                };
                const angle = (newRotate - rotate) * Math.PI / 180;
                nextImgCenter = {
                    x: (imgCenter.x - rotateCenter.x) * Math.cos(angle) + (imgCenter.y - rotateCenter.y) * Math.sin(angle) + rotateCenter.x,
                    y: - (-(imgCenter.x - rotateCenter.x) * Math.sin(angle) + (imgCenter.y - rotateCenter.y) * Math.cos(angle) + rotateCenter.y),
                };
            }
        }
        if (!isUndefined(newRotate) && newZoom !== zoom) {
            nextState.zoom = newZoom;
            if (loaded) {
                // 同上
                const scaleCenter = {
                    x: cropperBox.centerPoint.x,
                    y: - cropperBox.centerPoint.y
                };
                const currentImgCenter = {
                    x: nextImgCenter.x,
                    y: - nextImgCenter.y
                };
                nextWidth = imgData.width / zoom * newZoom;
                nextHeight = imgData.height / zoom * newZoom;
                nextImgCenter = {
                    x: (currentImgCenter.x - scaleCenter.x) / zoom * newZoom + scaleCenter.x,
                    y: - [(currentImgCenter.y - scaleCenter.y) / zoom * newZoom + scaleCenter.y],
                };
            } 
        }

        if ((newRotate !== rotate || newZoom !== zoom)) {
            nextState.imgData = {
                width: nextWidth,
                height: nextHeight,
                centerPoint: nextImgCenter,
            };
        }

        if (Object.keys(nextState).length) {
            return nextState;
        }
        return null;
    }

    componentDidMount(): void {
        this.foundation.init();
    }

    componentWillUnmount(): void {
        this.foundation.destroy();
        this.unRegisterImageWrapRef();
    }

    unRegisterImageWrapRef = (): void => {
        if (this.containerRef) {
            (this.containerRef as any).removeEventListener("wheel", this.foundation.handleWheel);
        }
        this.containerRef = null;
    };

    registryImageWrapRef = (ref: any): void => {
        this.unRegisterImageWrapRef();
        if (ref) {
            // We need to use preventDefault to prevent the page from being enlarged when zooming in with two fingers.
            ref.addEventListener("wheel", this.foundation.handleWheel, { passive: false });
        }
        this.containerRef = ref;
    };

    // ref method: Get the cropped canvas
    getCropperCanvas = () => {
        return this.foundation.getCropperCanvas();
    }

    render() {
        const { className, style, src, shape, showResizeBox, cropperBoxStyle, cropperBoxCls } = this.props;
        const { imgData, cropperBox, rotate, loaded } = this.state;
        const imgX = imgData.centerPoint.x - imgData.width / 2;
        const imgY = imgData.centerPoint.y - imgData.height / 2;
        const cropperBoxX = cropperBox.centerPoint.x - cropperBox.width / 2;
        const cropperBoxY = cropperBox.centerPoint.y - cropperBox.height / 2;
        const cropperImgX = imgX - cropperBoxX;
        const cropperImgY = imgY - cropperBoxY;

        this.foundation.updatePreview({
            width: imgData.width,
            height: imgData.height,
            translateX: cropperImgX, 
            translateY: cropperImgY,
            rotate: rotate,
        });

        return (<ResizeObserver 
            onResize={this.foundation.handleResize} 
            observerProperty={ObserverProperty.Width}
        >
            <div
                className={cls(prefixCls, className)}
                style={style}
                ref={this.registryImageWrapRef}
            >
                {/* Img layer */}
                <div className={cssClasses.IMG_WRAPPER}>
                    <img
                        ref={this.imgRef}
                        src={src}
                        onLoad={this.foundation.handleImageLoad}
                        className={cssClasses.IMG}
                        crossOrigin='anonymous'
                        style={{
                            width: imgData.width,
                            height: imgData.height,
                            transformOrigin: 'center',
                            transform: `translate(${imgX}px, ${imgY}px) rotate(${rotate}deg)`,
                        }}
                    />
                </div>
                {/* Mask layer */}
                <div 
                    className={cssClasses.MASK} 
                    onMouseDown={this.foundation.handleMaskMouseDown}
                />
                {/* Cropper box */}
                <div
                    className={cls(cssClasses.CROPPER_BOX, { 
                        [cropperBoxCls]: cropperBoxCls,
                        [cssClasses.CROPPER_VIEW_BOX_ROUND]: shape === 'round',
                    })}
                    style={{
                        ...cropperBoxStyle,
                        width: cropperBox.width,
                        height: cropperBox.height,
                        transform: `translate(${cropperBoxX}px, ${cropperBoxY}px)`,
                    }}
                    onMouseDown={this.foundation.handleCropperBoxMouseDown}
                >
                    <div 
                        className={cls(cssClasses.CROPPER_VIEW_BOX, {
                            [cssClasses.CROPPER_VIEW_BOX_ROUND]: shape.includes('round'),
                        })} 
                    >
                        <img 
                            onDragStart={this.foundation.viewIMGDragStart}
                            className={cssClasses.CROPPER_IMG}
                            src={src}
                            style={{
                                width: imgData.width,
                                height: imgData.height,
                                transformOrigin: 'center',
                                transform: `translate(${cropperImgX}px, ${cropperImgY}px) rotate(${rotate}deg)`,
                            }}
                        />
                    </div>
                    {/* 裁剪框的拖拽操作按钮 */}  
                    {loaded && showResizeBox && (shape === 'round' ? strings.roundCorner : strings.corner).map(corner => (
                        <div 
                            className={cls(cssClasses.CORNER, `${cssClasses.CORNER}-${corner}`)}
                            data-dir={corner}
                            key={corner}
                            onMouseDown={this.foundation.handleCornerMouseDown}
                        />
                    ))}
                </div>
            </div>
        </ResizeObserver>);
    }
}

export default Cropper;
