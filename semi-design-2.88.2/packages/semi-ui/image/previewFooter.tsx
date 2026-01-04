import React, { ReactNode } from "react";
import BaseComponent from "../_base/baseComponent";
import { IconChevronLeft, IconChevronRight, IconMinus, IconPlus, IconRotate, IconDownload, IconWindowAdaptionStroked, IconRealSizeStroked, IconSize } from "@douyinfe/semi-icons";
import { FooterProps } from "./interface";
import PropTypes from "prop-types";
import Tooltip from "../tooltip";
import Divider from "../divider";
import Slider from "../slider";
import Icon from "../icons";
import { cssClasses } from "@douyinfe/semi-foundation/image/constants";
import cls from "classnames";
import PreviewFooterFoundation, { PreviewFooterAdapter } from "@douyinfe/semi-foundation/image/previewFooterFoundation";
import LocaleConsumer from "../locale/localeConsumer";
import { Locale } from "../locale/interface";
import { throttle } from "lodash";

const prefixCls = cssClasses.PREFIX;
const footerPrefixCls = `${cssClasses.PREFIX}-preview-footer`;

export default class Footer extends BaseComponent<FooterProps> {
    static propTypes = {
        curPage: PropTypes.number,
        totalNum: PropTypes.number,
        disabledPrev: PropTypes.bool,
        disabledNext: PropTypes.bool,
        disableDownload: PropTypes.bool,
        className: PropTypes.string,
        zoom: PropTypes.number,
        ratio: PropTypes.string,
        prevTip: PropTypes.string,
        nextTip: PropTypes.string,
        zoomInTip: PropTypes.string,
        zoomOutTip: PropTypes.string,
        rotateTip: PropTypes.string,
        downloadTip: PropTypes.string,
        adaptiveTip: PropTypes.string,
        originTip: PropTypes.string,
        showTooltip: PropTypes.bool,
        onZoomIn: PropTypes.func,
        onZoomOut: PropTypes.func,
        onPrev: PropTypes.func,
        onNext: PropTypes.func,
        onAdjustRatio: PropTypes.func,
        onRotateLeft: PropTypes.func,
        onDownload: PropTypes.func,
    }

    static defaultProps = {
        min: 10,
        max: 500,
        step: 10,
        showTooltip: false,
        disableDownload: false,
    }

    get adapter(): PreviewFooterAdapter<FooterProps> {
        return {
            ...super.adapter,
        };
    }

    foundation: PreviewFooterFoundation;

    constructor(props: FooterProps) {
        super(props);
        this.foundation = new PreviewFooterFoundation(this.adapter);
    }

    changeSliderValue = (type: string): void => {
        this.foundation.changeSliderValue(type);
    };

    handleMinusClick = () => {
        this.changeSliderValue("minus");
    }

    handlePlusClick = () => {
        this.changeSliderValue("plus");
    }

    handleRotateLeft = () => {
        this.foundation.handleRotate("left");
    }

    handleRotateRight = () => {
        this.foundation.handleRotate("right");
    }

    handleSlideChange = throttle((value): void => {
        this.foundation.handleValueChange(value);
    }, 50);

    handleRatioClick = (): void => {
        this.foundation.handleRatioClick();
    }

    customRenderViewMenu = (): ReactNode => {
        const { min, max, step, curPage, totalNum, ratio, zoom, disabledPrev, disabledNext, 
            disableDownload, onNext, onPrev, onDownload, renderPreviewMenu } 
        = this.props;

        const props = { min, max, step, curPage, totalNum, ratio, zoom,
            disabledPrev, disabledNext, disableDownload, onNext, onPrev, onDownload,
            onRotateLeft: this.handleRotateLeft,
            onRotateRight: this.handleRotateRight,
            disabledZoomIn: zoom === max,
            disabledZoomOut: zoom === min,
            onRatioClick: this.handleRatioClick,
            onZoomIn: this.handlePlusClick,
            onZoomOut: this.handleMinusClick,
            menuItems: this.getMenu()
        };
        return renderPreviewMenu(props);
    }

    // According to showTooltip in props, decide whether to use Tooltip to pack a layer
    // 根据 props 中的 showTooltip 决定是否使用 Tooltip 包一层
    getFinalIconElement = (element: ReactNode, content: ReactNode, key: string, gap: boolean = false) => {
        const { showTooltip, zIndex } = this.props;
        return showTooltip ? (
            <Tooltip content={content} key={`tooltip-${key}`} zIndex={zIndex + 1}>
                <span className={cls(`${prefixCls}-tooltip-children-wrapper`, { [`${footerPrefixCls}-gap`]: gap })}>
                    {element}
                </span>
            </Tooltip>
        ) : element;
    }

    getLocalTextByKey = (key: string) => (
        <LocaleConsumer<Locale["Image"]> componentName="Image" >
            {(locale: Locale["Image"]) => locale[key]}
        </LocaleConsumer>
    );

    getIconChevronLeft = () => {
        const { disabledPrev, onPrev, prevTip } = this.props;
        const icon = <IconChevronLeft
            key="chevron-left"
            size="large"
            className={disabledPrev ? `${footerPrefixCls}-disabled` : ""}
            onClick={!disabledPrev ? onPrev : undefined}
        />;
        const content = prevTip ?? this.getLocalTextByKey("prevTip");
        return this.getFinalIconElement(icon, content, 'chevron-left');
    }

    getIconChevronRight = () => {
        const { disabledNext, onNext, nextTip } = this.props;
        const icon = <IconChevronRight
            key="chevron-right"
            size="large"
            className={disabledNext ? `${footerPrefixCls}-disabled` : ""}
            onClick={!disabledNext ? onNext : undefined}
        />;
        const content = nextTip ?? this.getLocalTextByKey("nextTip");
        return this.getFinalIconElement(icon, content, 'chevron-right');
    }

    getIconMinus = () => {
        const { zoomOutTip, zoom, min } = this.props;
        const disabledZoomOut = zoom === min;
        const icon = <IconMinus
            key="minus"
            size="large" 
            onClick={!disabledZoomOut ? this.handleMinusClick : undefined} 
            className={disabledZoomOut ? `${footerPrefixCls}-disabled` : ""}
        />;
        const content = zoomOutTip ?? this.getLocalTextByKey("zoomOutTip");
        return this.getFinalIconElement(icon, content, 'minus');
    }

    getIconPlus = () => {
        const { zoomInTip, zoom, max } = this.props;
        const disabledZoomIn = zoom === max;
        const icon = <IconPlus
            key="plus"
            size="large" 
            onClick={!disabledZoomIn ? this.handlePlusClick : undefined}  
            className={disabledZoomIn ? `${footerPrefixCls}-disabled` : ""}
        />;
        const content = zoomInTip ?? this.getLocalTextByKey("zoomInTip");
        return this.getFinalIconElement(icon, content, 'plus');
    }

    getIconRatio = () => {
        const { ratio, originTip, adaptiveTip, showTooltip } = this.props;
        const props = {
            key: "ratio",
            size: "large" as IconSize,
            className: showTooltip ? undefined : `${footerPrefixCls}-gap`,
            onClick: this.handleRatioClick,
        };
        const icon = ratio === "adaptation" ? <IconRealSizeStroked {...props} /> : <IconWindowAdaptionStroked {...props} />;
        let content: any;
        if (ratio === "adaptation") {
            content = originTip ?? this.getLocalTextByKey("originTip");
        } else {
            content = adaptiveTip ?? this.getLocalTextByKey("adaptiveTip");
        }
        return this.getFinalIconElement(icon, content, 'ratio', true);
    }

    getIconRotate = () => {
        const { rotateTip } = this.props;
        const icon = <IconRotate
            key="rotate"
            size="large"
            onClick={this.handleRotateLeft}
        />;
        const content = rotateTip ?? this.getLocalTextByKey("rotateTip");
        return this.getFinalIconElement(icon, content, 'rotate');
    }

    getIconDownload = () => {
        const { downloadTip, onDownload, disableDownload, showTooltip } = this.props;
        const icon = <IconDownload
            key='download'
            size="large"
            onClick={!disableDownload ? onDownload : undefined}
            className={cls(
                {
                    [`${footerPrefixCls}-gap`]: !showTooltip,
                    [`${footerPrefixCls}-disabled`]: disableDownload,
                },
            )}
        />;
        const content = downloadTip ?? this.getLocalTextByKey("downloadTip");
        return this.getFinalIconElement(icon, content, 'download', true);
    }

    getNumberInfo = () => {
        const { curPage, totalNum } = this.props;
        return (
            <div className={`${footerPrefixCls}-page`} key={'info'} >
                {curPage}/{totalNum}
            </div>
        );
    }

    getSlider = () => {
        const { zoom, min, max, step, showTooltip } = this.props;
        return (
            <Slider
                key={'slider'}
                value={zoom}
                min={min}
                max={max}
                step={step}
                tipFormatter={(v): string => `${v}%`}
                tooltipVisible={showTooltip ? undefined : false }
                onChange={this.handleSlideChange}
            />
        );
    }

    getMenu = () => ([
        this.getIconChevronLeft(),
        this.getNumberInfo(),
        this.getIconChevronRight(),
        this.getIconMinus(),
        this.getSlider(),
        this.getIconPlus(),
        this.getIconRatio(),
        this.getIconRotate(),
        this.getIconDownload()
    ]);

    getFooterMenu = () => {
        const menuItems = this.getMenu();
        menuItems.splice(3, 0, <Divider layout="vertical" key={"divider-first"}/>);
        menuItems.splice(8, 0, <Divider layout="vertical" key={"divider-second"} />);
        return menuItems;
    }

    render() {
        const { className, renderPreviewMenu, forwardRef } = this.props;

        const menuCls = cls(footerPrefixCls, `${footerPrefixCls}-wrapper`, className,
            {
                [`${footerPrefixCls}-content`]: !Boolean(renderPreviewMenu),
            },
        );

        return (
            <section className={menuCls} ref={forwardRef}>
                {renderPreviewMenu ? this.customRenderViewMenu() : this.getFooterMenu()}
            </section>
        );
    }
}




