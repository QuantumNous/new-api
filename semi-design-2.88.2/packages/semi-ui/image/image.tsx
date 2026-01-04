import React from "react";
import BaseComponent from "../_base/baseComponent";
import { ImageProps, ImageStates } from "./interface";
import PropTypes from "prop-types";
import { cssClasses } from "@douyinfe/semi-foundation/image/constants";
import cls from "classnames";
import { IconUploadError, IconEyeOpened } from "@douyinfe/semi-icons";
import PreviewInner from "./previewInner";
import { PreviewContext, PreviewContextProps } from "./previewContext";
import ImageFoundation, { ImageAdapter } from "@douyinfe/semi-foundation/image/imageFoundation";
import LocaleConsumer from "../locale/localeConsumer";
import { Locale } from "../locale/interface";
import { isBoolean, isObject, isUndefined, omit } from "lodash";
import Skeleton from "../skeleton";
import "@douyinfe/semi-foundation/image/image.scss";

const prefixCls = cssClasses.PREFIX;

export default class Image extends BaseComponent<ImageProps, ImageStates> {
    static isSemiImage = true;
    static contextType = PreviewContext;
    static propTypes = {
        style: PropTypes.object,
        className: PropTypes.string,
        src: PropTypes.string,
        width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        alt: PropTypes.string,
        placeholder: PropTypes.node,
        fallback: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
        preview: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
        onLoad: PropTypes.func,
        onError: PropTypes.func,
        onClick: PropTypes.func,
        crossOrigin: PropTypes.string,
        imageID: PropTypes.number,
    }

    static defaultProps = {
        preview: true,
    };

    get adapter(): ImageAdapter<ImageProps, ImageStates> {
        return {
            ...super.adapter,
            getIsInGroup: () => this.isInGroup(),
        };
    }

    context: PreviewContextProps;
    foundation: ImageFoundation;
    imgRef: React.RefObject<HTMLImageElement>;

    constructor(props: ImageProps) {
        super(props);
        this.state = {
            src: "",
            loadStatus: "loading",
            previewVisible: false,
        };

        this.foundation = new ImageFoundation(this.adapter);
        this.imgRef = React.createRef<HTMLImageElement>();
    }

    static getDerivedStateFromProps(props: ImageProps, state: ImageStates) {
        const willUpdateStates: Partial<ImageStates> = {};

        if (props.src !== state.src) {
            willUpdateStates.src = props.src;
            willUpdateStates.loadStatus = "loading";
        }

        if (isObject(props.preview)) {
            const { visible } = props.preview;
            if (isBoolean(visible)) {
                willUpdateStates.previewVisible = visible;
            }
        }

        return willUpdateStates;
    }

    isInGroup() {
        return Boolean(this.context && this.context.isGroup);
    }

    isLazyLoad() {
        if (this.context) {
            return this.context.lazyLoad;
        }
        return false;
    }

    handleClick = (e) => {
        this.foundation.handleClick(e);
    };

    handleLoaded = (e) => {
        this.foundation.handleLoaded(e);
    }

    handleError = (e) => {
        this.foundation.handleError(e);
    }

    handlePreviewVisibleChange = (visible: boolean) => {
        this.foundation.handlePreviewVisibleChange(visible);
    }

    renderDefaultLoading = () => {
        const { width, height } = this.props;
        return (
            <Skeleton.Image style={{ width, height }} />
        );
    };

    renderDefaultError = () => {
        const prefixClsName = `${prefixCls}-status`;
        return (
            <div className={prefixClsName}>
                <IconUploadError size={"extra-large"} />
            </div>
        );
    };

    renderLoad = () => {
        const prefixClsName = `${prefixCls}-status`;
        const { placeholder } = this.props;
        return (
            placeholder ? (
                <div className={prefixClsName}>
                    {placeholder}
                </div>
            ) : this.renderDefaultLoading()
        );
    }

    renderError = () => {
        const { fallback } = this.props;
        const prefixClsName = `${prefixCls}-status`;
        const fallbackNode = typeof fallback === "string" ? (<img style={{ width: "100%", height: "100%" }} src={fallback} alt="fallback" />) : fallback;
        return (
            fallback ? (
                <div className={prefixClsName}>
                    {fallbackNode}
                </div>
            ) : this.renderDefaultError()
        );
    }

    renderExtra = () => {
        const { loadStatus } = this.state;
        return (
            <div className={`${prefixCls}-overlay`}>
                {loadStatus === "error" && this.renderError()}
                {loadStatus === "loading" && this.renderLoad()}
            </div>
        );
    }

    getLocalTextByKey = (key: string) => (
        <LocaleConsumer<Locale["Image"]> componentName="Image" >
            {(locale: Locale["Image"]) => locale[key]}
        </LocaleConsumer>
    );

    renderMask = () => (<div className={`${prefixCls}-mask`}>
        <div className={`${prefixCls}-mask-info`}>
            <IconEyeOpened size="extra-large" />
            <span className={`${prefixCls}-mask-info-text`}>{this.getLocalTextByKey("preview")}</span>
        </div>
    </div>);

    render() {
        const { src, loadStatus, previewVisible } = this.state;
        const { src: picSrc, width, height, alt, style, className, crossOrigin, preview,
            fallback, placeholder, imageID, setDownloadName, imgCls, imgStyle,
            ...restProps
        } = this.props;
        const outerStyle = Object.assign({ width, height }, style);
        const outerCls = cls(prefixCls, className);
        const canPreview = loadStatus === "success" && preview && !this.isInGroup();
        const showPreviewCursor = preview && loadStatus === "success";
        const previewSrc = isObject(preview) ? ((preview as any).src ?? src) : src;
        const previewProps = isObject(preview) && canPreview ? {
            ...omit(preview, ['className', 'style', 'previewCls', 'previewStyle']),
            className: preview?.previewCls,
            style: preview?.previewStyle
        } : {} as any;
        return (
            <div
                style={outerStyle}
                className={outerCls}
                onClick={this.handleClick}
            >
                <img
                    ref={this.imgRef}
                    {...restProps}
                    src={this.isInGroup() && this.isLazyLoad() ? undefined : src}
                    data-src={src}
                    alt={alt}
                    style={imgStyle}
                    className={cls(`${prefixCls}-img`, {
                        [`${prefixCls}-img-preview`]: showPreviewCursor,
                        [`${prefixCls}-img-error`]: loadStatus === "error",
                        [imgCls]: Boolean(imgCls),
                    })}
                    width={width}
                    height={height}
                    crossOrigin={crossOrigin}
                    onError={this.handleError}
                    onLoad={this.handleLoaded}
                />
                {loadStatus !== "success" && this.renderExtra()}
                {canPreview &&
                    <PreviewInner
                        {...previewProps}
                        src={previewSrc}
                        visible={previewVisible}
                        onVisibleChange={this.handlePreviewVisibleChange}
                        crossOrigin={!isUndefined(crossOrigin) ? crossOrigin : previewProps?.crossOrigin}
                        setDownloadName={setDownloadName}
                    />
                }
            </div>
        );
    }
}
