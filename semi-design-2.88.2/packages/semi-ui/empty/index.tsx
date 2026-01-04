import React from 'react';
import cls from 'classnames';
import { cssClasses, strings } from '@douyinfe/semi-foundation/empty/constants';
import '@douyinfe/semi-foundation/empty/empty.scss';
import Typography from '../typography';
import BaseComponent from '../_base/baseComponent';
import { ArrayElement } from '../_base/base';

const prefixCls = cssClasses.PREFIX;

interface SVGNode {
    id?: string;
    viewBox?: string;
    url?: string
}

export interface EmptyProps {
    layout?: ArrayElement<typeof strings.LAYOUT>;
    imageStyle?: React.CSSProperties;
    title?: React.ReactNode;
    description?: React.ReactNode;
    image?: React.ReactNode | SVGNode;
    darkModeImage?: React.ReactNode | SVGNode;
    style?: React.CSSProperties;
    className?: string;
    children?: React.ReactNode
}

interface EmptyState {
    mode: any
}

export default class Empty extends BaseComponent<EmptyProps, EmptyState> {

    static defaultProps = {
        layout: 'vertical',
    };

    body: any;
    observer: MutationObserver;

    constructor(props: EmptyProps) {
        super(props);
        this.state = {
            mode: null
        };
    }

    componentDidMount(): void {
        if (this.props.darkModeImage) {
            this.body = window.document.body;
            this.updateMode();
            const config = { attributes: true, childList: false, subtree: false };
            this.observer = new MutationObserver(this.observe);
            this.observer.observe(this.body, config);
        }
    }

    componentWillUnmount(): void {
        this.observer && this.observer.disconnect();
    }

    observe = (mutationsList: any): void => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'theme-mode') {
                this.updateMode();
            }
        }
    }

    updateMode = (): void => {
        const val = this.body.getAttribute('theme-mode');
        if (val !== this.state.mode) {
            this.setState({ mode: val });
        }
    }

    render(): JSX.Element {
        const { className, image, description, style, title, imageStyle, children, layout, darkModeImage, ...rest } = this.props;

        const alt = typeof description === 'string' ? description : 'empty';
        const imgSrc = ((this.state.mode === 'dark') && darkModeImage) ? darkModeImage : image;
        let imageNode = null;
        if (typeof imgSrc === 'string') {
            imageNode = <img alt={alt} src={imgSrc}/>;
        } else if (imgSrc && 'id' in (imgSrc as any)) {
            imageNode = (
                <svg
                    // className={iconCls}
                    aria-hidden="true"
                >
                    <use xlinkHref={`#${(imgSrc as any).id}`}/>
                </svg>
            );
        } else {
            imageNode = imgSrc;
        }
        const wrapperCls = cls(className, prefixCls, {
            [`${prefixCls}-${layout}`]: layout,
        });

        const titleProps = imageNode ?
            {
                heading: 4,
            } :
            {
                heading: 6,
                style: { fontWeight: 400 },
            };
        return (
            <div className={wrapperCls} style={style} {...this.getDataAttr(rest)}>
                <div className={`${prefixCls}-image`} style={imageStyle} x-semi-prop="image,darkModeImage">
                    {imageNode}
                </div>
                <div className={`${prefixCls}-content`}>
                    {title ? (
                        <Typography.Title {...(titleProps as any)} className={`${prefixCls}-title`} x-semi-prop="title">
                            {title}
                        </Typography.Title>
                    ) : null}
                    {description ? (
                        <div className={`${prefixCls}-description`} x-semi-prop="description">
                            {description}
                        </div>
                    ) : null}
                    {children ? (
                        <div className={`${prefixCls}-footer`} x-semi-prop="children">
                            {children}
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }
}
