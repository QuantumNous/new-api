import React, { CSSProperties } from "react";
import BaseComponent from "../_base/baseComponent";
import { PreviewInnerProps, PreviewInnerStates } from "./interface";
import PropTypes from "prop-types";
import { cssClasses, numbers } from "@douyinfe/semi-foundation/image/constants";
import cls from "classnames";
import { isEqual, isFunction } from "lodash";
import Portal from "../_portal";
import { IconArrowLeft, IconArrowRight } from "@douyinfe/semi-icons";
import Header from "./previewHeader";
import Footer from "./previewFooter";
import PreviewImage from "./previewImage";
import PreviewInnerFoundation, { PreviewInnerAdapter, RatioType } from "@douyinfe/semi-foundation/image/previewInnerFoundation";
import { PreviewContext, PreviewContextProps } from "./previewContext";
import { getScrollbarWidth } from "../_utils";
import ReactDOM from "react-dom";

const prefixCls = cssClasses.PREFIX;

export default class PreviewInner extends BaseComponent<PreviewInnerProps, PreviewInnerStates> {
    static contextType = PreviewContext;

    static propTypes = {
        style: PropTypes.object,
        className: PropTypes.string,
        visible: PropTypes.bool,
        src: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
        currentIndex: PropTypes.number,
        defaultCurrentIndex: PropTypes.number,
        defaultVisible: PropTypes.bool,
        maskClosable: PropTypes.bool,
        closable: PropTypes.bool,
        zoomStep: PropTypes.number,
        infinite: PropTypes.bool,
        showTooltip: PropTypes.bool,
        closeOnEsc: PropTypes.bool,
        prevTip: PropTypes.string,
        nextTip: PropTypes.string,
        zoomInTip: PropTypes.string,
        zoomOutTip: PropTypes.string,
        downloadTip: PropTypes.string,
        adaptiveTip: PropTypes.string,
        originTip: PropTypes.string,
        lazyLoad: PropTypes.bool,
        preLoad: PropTypes.bool,
        preLoadGap: PropTypes.number,
        disableDownload: PropTypes.bool,
        viewerVisibleDelay: PropTypes.number,
        zIndex: PropTypes.number,
        maxZoom: PropTypes.number,
        minZoom: PropTypes.number,
        renderHeader: PropTypes.func,
        renderPreviewMenu: PropTypes.func,
        getPopupContainer: PropTypes.func,
        onVisibleChange: PropTypes.func,
        onChange: PropTypes.func,
        onClose: PropTypes.func,
        onZoomIn: PropTypes.func,
        onZoomOut: PropTypes.func,
        onPrev: PropTypes.func,
        onNext: PropTypes.func,
        onDownload: PropTypes.func,
        onRatioChange: PropTypes.func,
        onRotateLeft: PropTypes.func,
    }

    static defaultProps = {
        showTooltip: false,
        zoomStep: 0.1,
        infinite: false,
        closable: true,
        closeOnEsc: true,
        lazyLoad: false,
        preLoad: true,
        preLoadGap: 2,
        zIndex: numbers.DEFAULT_Z_INDEX,
        maskClosable: true,
        viewerVisibleDelay: 10000,
        maxZoom: 5,
        minZoom: 0.1
    };

    private bodyOverflow: string;
    private scrollBarWidth: number;
    private originBodyWidth: string;

    get adapter(): PreviewInnerAdapter<PreviewInnerProps, PreviewInnerStates> {
        return {
            ...super.adapter,
            getIsInGroup: () => this.isInGroup(),
            disabledBodyScroll: () => {
                const { getPopupContainer } = this.props;
                this.bodyOverflow = document.body.style.overflow || '';
                if (!getPopupContainer && this.bodyOverflow !== 'hidden') {
                    document.body.style.overflow = 'hidden';
                    document.body.style.width = `calc(${this.originBodyWidth || '100%'} - ${this.scrollBarWidth}px)`;
                }
            },
            enabledBodyScroll: () => {
                const { getPopupContainer } = this.props;
                if (!getPopupContainer && this.bodyOverflow !== 'hidden') {
                    document.body.style.overflow = this.bodyOverflow;
                    document.body.style.width = this.originBodyWidth;
                }
            },
            notifyChange: (index: number, direction: string) => {
                const { onChange, onPrev, onNext } = this.props;
                isFunction(onChange) && onChange(index);
                if (direction === "prev") {
                    onPrev && onPrev(index);
                } else {
                    onNext && onNext(index);
                }
            },
            notifyZoom: (zoom: number, increase: boolean) => {
                const { onZoomIn, onZoomOut } = this.props;
                if (increase) {
                    isFunction(onZoomIn) && onZoomIn(zoom);
                } else {
                    isFunction(onZoomOut) && onZoomOut(zoom);
                }
            },
            notifyClose: () => {
                const { onClose } = this.props;
                isFunction(onClose) && onClose();
            },
            notifyVisibleChange: (visible: boolean) => {
                const { onVisibleChange } = this.props;
                isFunction(onVisibleChange) && onVisibleChange(visible);
            },
            notifyRatioChange: (type: RatioType) => {
                const { onRatioChange } = this.props;
                isFunction(onRatioChange) && onRatioChange(type);
            },
            notifyRotateChange: (angle: number) => {
                const { onRotateLeft } = this.props;
                isFunction(onRotateLeft) && onRotateLeft(angle);
            },
            notifyDownload: (src: string, index: number) => {
                const { onDownload } = this.props;
                isFunction(onDownload) && onDownload(src, index);
            },
            notifyDownloadError: (src: string) => {
                const { onDownloadError } = this.props;
                isFunction(onDownloadError) && onDownloadError(src);
            },
            registerKeyDownListener: () => {
                window && window.addEventListener("keydown", this.handleKeyDown);
            },
            unregisterKeyDownListener: () => {
                window && window.removeEventListener("keydown", this.handleKeyDown);
            },
            getSetDownloadFunc: () => {
                return this.context?.setDownloadName ?? this.props.setDownloadName;
            },
            isValidTarget: (e) => {
                const headerDom = this.headerRef && this.headerRef.current;
                const footerDom = this.footerRef && this.footerRef.current;
                const leftIconDom = this.leftIconRef && this.leftIconRef.current;
                const rightIconDom = this.rightIconRef && this.rightIconRef.current;
                const target = e.target as any;
                if (
                    headerDom && headerDom.contains(target) ||
                    footerDom && footerDom.contains(target) ||
                    leftIconDom && leftIconDom.contains(target) ||
                    rightIconDom && rightIconDom.contains(target)
                ) {
                    // Move in the operation area, return false
                    return false;
                }
                // Move in the preview area except the operation area, return true
                return true;
            },
            changeImageZoom: (...args) => {
                this.imageRef?.current && this.imageRef.current.foundation.changeZoom(...args);
            }
        };

    }

    context: PreviewContextProps;
    foundation: PreviewInnerFoundation;
    imageWrapRef: React.RefObject<HTMLDivElement>;
    headerRef: React.RefObject<HTMLElement>;
    imageRef: React.RefObject<PreviewImage>;
    footerRef: React.RefObject<HTMLElement>;
    leftIconRef: React.RefObject<HTMLDivElement>;
    rightIconRef: React.RefObject<HTMLDivElement>;

    constructor(props: PreviewInnerProps) {
        super(props);
        this.state = {
            imgSrc: [],
            imgLoadStatus: new Map(),
            zoom: 0.1,
            currentIndex: 0,
            ratio: "adaptation",
            rotation: 0,
            viewerVisible: true,
            visible: false,
            preloadAfterVisibleChange: true,
            direction: "",
        };
        this.foundation = new PreviewInnerFoundation(this.adapter);
        this.bodyOverflow = '';
        this.originBodyWidth = '100%';
        this.scrollBarWidth = 0;
        this.imageWrapRef = null;
        this.imageRef = React.createRef<PreviewImage>();
        this.headerRef = React.createRef<HTMLElement>();
        this.footerRef = React.createRef<HTMLElement>();
        this.leftIconRef = React.createRef<HTMLDivElement>();
        this.rightIconRef = React.createRef<HTMLDivElement>();
    }

    static getDerivedStateFromProps(props: PreviewInnerProps, state: PreviewInnerStates) {
        const willUpdateStates: Partial<PreviewInnerStates> = {};
        let src = [];
        if (props.visible) {
            // if src in props
            src = Array.isArray(props.src) ? props.src : [props.src];
        }
        if (!isEqual(src, state.imgSrc)) {
            willUpdateStates.imgSrc = src;
        }
        if (props.visible !== state.visible) {
            willUpdateStates.visible = props.visible;
            if (props.visible) {
                willUpdateStates.preloadAfterVisibleChange = true;
                willUpdateStates.viewerVisible = true;
                willUpdateStates.rotation = 0;
                willUpdateStates.ratio = 'adaptation';
            }
        }
        if ("currentIndex" in props && props.currentIndex !== state.currentIndex) {
            willUpdateStates.currentIndex = props.currentIndex;
            // ratio will set to adaptation when change picture, 
            // attention: If the ratio is controlled, the ratio should not change as the index changes
            willUpdateStates.ratio = 'adaptation';
        }
        return willUpdateStates;
    }

    componentDidMount() {
        this.scrollBarWidth = getScrollbarWidth();
        this.originBodyWidth = document.body.style.width;
        if (this.props.visible) {
            this.foundation.beforeShow();
        }
    }

    componentDidUpdate(prevProps: PreviewInnerProps, prevState: PreviewInnerStates) {
        if (prevProps.src !== this.props.src) {
            this.foundation.updateTimer();
        }
        // hide => show
        if (!prevProps.visible && this.props.visible) {
            this.foundation.beforeShow();
        }
        // show => hide
        if (prevProps.visible && !this.props.visible) {
            this.foundation.afterHide();
        }
    }

    componentWillUnmount() {
        this.foundation.clearTimer();
    }

    isInGroup() {
        return Boolean(this.context && this.context.isGroup);
    }

    viewVisibleChange = () => {
        this.foundation.handleViewVisibleChange();
    }

    handleSwitchImage = (direction: string) => {
        this.foundation.handleSwitchImage(direction);
    }

    handleDownload = () => {
        this.foundation.handleDownload();
    }

    handlePreviewClose = (e: React.MouseEvent<HTMLElement>) => {
        this.foundation.handlePreviewClose(e);
    }

    handleAdjustRatio = (type: RatioType) => {
        this.foundation.handleAdjustRatio(type);
    }

    handleRotateImage = (direction) => {
        this.foundation.handleRotateImage(direction);
    }

    handleZoomImage = (newZoom: number, notify: boolean = true) => {
        this.foundation.handleZoomImage(newZoom, notify);
    }

    handleMouseUp = (e): void => {
        this.foundation.handleMouseUp(e.nativeEvent);
    }

    handleMouseMove = (e): void => {
        this.foundation.handleMouseMove(e);
    }


    handleKeyDown = (e: KeyboardEvent) => {
        this.foundation.handleKeyDown(e);
    };

    onImageError = () => {
        this.foundation.preloadSingleImage();
    }

    onImageLoad = (src) => {
        this.foundation.onImageLoad(src);
    }

    handleMouseDown = (e): void => {
        this.foundation.handleMouseDown(e);
    }

    handleWheel = (e) => {
        this.foundation.handleWheel(e);
    }

    // 为什么通过 addEventListener 注册 wheel 事件而不是使用 onWheel 事件？
    // 因为 Passive Event Listeners（https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#improving_scrolling_performance_with_passive_listeners）
    // Passive Event Listeners 是一种优化技术，用于提高滚动性能。在默认情况下，浏览器会假设事件的监听器不会调用 
    // preventDefault() 方法来阻止事件的默认行为，从而允许进行一些优化操作，例如滚动平滑。
    // 对于 Image 而言，如果使用触控板，双指朝不同方向分开放大图片，则需要  preventDefault 防止页面整体放大。
    // Why register wheel event through addEventListener instead of using onWheel event？
    // Because of Passive Event Listeners(an optimization technique used to improve scrolling performance. By default, 
    // the browser will assume that event listeners will not call preventDefault() method to prevent the default behavior of the event, 
    // allowing some optimization operations such as scroll smoothing.)
    // For Image, if we use the trackpad and spread your fingers in different directions to enlarge the image, we need to preventDefault
    // to prevent the page from being enlarged as a whole.
    registryImageWrapRef = (ref): void => {
        if (this.imageWrapRef) {
            (this.imageWrapRef as any).removeEventListener("wheel", this.handleWheel);
        }
        if (ref) {
            ref.addEventListener("wheel", this.handleWheel, { passive: false });
        }
        this.imageWrapRef = ref;
    };

    render() {
        const {
            getPopupContainer,
            closable,
            zIndex,
            visible,
            className,
            style,
            infinite,
            zoomStep,
            crossOrigin,
            prevTip,
            nextTip,
            zoomInTip,
            zoomOutTip,
            rotateTip,
            downloadTip,
            adaptiveTip,
            originTip,
            showTooltip,
            disableDownload,
            renderLeftIcon,
            renderRightIcon,
            renderCloseIcon,
            renderPreviewMenu,
            renderHeader,
        } = this.props;
        const { currentIndex, imgSrc, zoom, ratio, rotation, viewerVisible } = this.state;
        let wrapperStyle: {
            zIndex?: CSSProperties["zIndex"];
            position?: CSSProperties["position"]
        } = {
            zIndex,
        };

        if (getPopupContainer) {
            wrapperStyle = {
                zIndex,
                position: "static",
            };
        }
        const previewPrefixCls = `${prefixCls}-preview`;
        const previewWrapperCls = cls(previewPrefixCls,
            {
                [`${prefixCls}-hide`]: !visible,
                [`${previewPrefixCls}-popup`]: getPopupContainer,
            },
            className,
        );
        const hideViewerCls = !viewerVisible ? `${previewPrefixCls}-hide` : "";
        const total = imgSrc.length;
        const showPrev = total !== 1 && (infinite || currentIndex !== 0);
        const showNext = total !== 1 && (infinite || currentIndex !== total - 1);

        const leftIcon = typeof renderLeftIcon === 'function' ? renderLeftIcon(currentIndex) : renderLeftIcon;
        const rightIcon = typeof renderRightIcon === 'function' ? renderRightIcon(currentIndex) : renderRightIcon;
        return (
            visible && <Portal
                getPopupContainer={getPopupContainer}
                style={wrapperStyle}
            >
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                <div
                    className={previewWrapperCls}
                    style={style}
                    onMouseDown={this.handleMouseDown}
                    onMouseUp={this.handleMouseUp}
                    ref={this.registryImageWrapRef}
                    onMouseMove={this.handleMouseMove}
                >
                    <Header ref={this.headerRef} className={cls(hideViewerCls)} onClose={this.handlePreviewClose} renderHeader={renderHeader} closable={closable} renderCloseIcon={renderCloseIcon} />
                    <PreviewImage
                        ref={this.imageRef}
                        src={imgSrc[currentIndex]}
                        onZoom={this.handleZoomImage}
                        disableDownload={disableDownload}
                        setRatio={this.handleAdjustRatio}
                        zoom={zoom}
                        ratio={ratio}
                        rotation={rotation}
                        crossOrigin={crossOrigin}
                        onError={this.onImageError}
                        onLoad={this.onImageLoad}
                    />
                    {showPrev && (
                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
                        <div
                            ref={this.leftIconRef}
                            className={cls(`${previewPrefixCls}-icon`, `${previewPrefixCls}-prev`, hideViewerCls)}
                            onClick={(): void => this.handleSwitchImage("prev")}
                        >
                            {React.isValidElement(leftIcon) ? leftIcon : <IconArrowLeft size="large" />}
                        </div>
                    )}
                    {showNext && (
                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
                        <div
                            ref={this.rightIconRef}
                            className={cls(`${previewPrefixCls}-icon`, `${previewPrefixCls}-next`, hideViewerCls)}
                            onClick={(): void => this.handleSwitchImage("next")}
                        >
                            {React.isValidElement(rightIcon) ? rightIcon : <IconArrowRight size="large" />}
                        </div>
                    )}
                    <Footer
                        forwardRef={this.footerRef}
                        className={hideViewerCls}
                        totalNum={total}
                        curPage={currentIndex + 1}
                        disabledPrev={!showPrev}
                        disabledNext={!showNext}
                        zoom={zoom * 100}
                        step={zoomStep * 100}
                        showTooltip={showTooltip}
                        ratio={ratio}
                        prevTip={prevTip}
                        nextTip={nextTip}
                        zIndex={zIndex}
                        zoomInTip={zoomInTip}
                        zoomOutTip={zoomOutTip}
                        rotateTip={rotateTip}
                        downloadTip={downloadTip}
                        disableDownload={disableDownload}
                        adaptiveTip={adaptiveTip}
                        originTip={originTip}
                        onPrev={(): void => this.handleSwitchImage("prev")}
                        onNext={(): void => this.handleSwitchImage("next")}
                        onZoomIn={this.handleZoomImage}
                        onZoomOut={this.handleZoomImage}
                        onDownload={this.handleDownload}
                        onRotate={this.handleRotateImage}
                        onAdjustRatio={this.handleAdjustRatio}
                        renderPreviewMenu={renderPreviewMenu}
                    />
                </div>
            </Portal>
        );
    }
}
