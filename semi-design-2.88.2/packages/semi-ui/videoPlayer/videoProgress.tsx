import React from 'react';
import cls from 'classnames';
import '@douyinfe/semi-foundation/videoPlayer/videoPlayer.scss';
import { cssClasses } from '@douyinfe/semi-foundation/videoPlayer/constants';
import VideoProgressFoundation, { Marker, MarkerListItem, VideoProgressAdapter } from '@douyinfe/semi-foundation/videoPlayer/progressFoundation';
import Tooltip from '../tooltip';
import { noop } from 'lodash';
import { formatTime } from './utils';
import BaseComponent from '../_base/baseComponent';

export interface VideoProgressProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
    max: number;
    showTooltip?: boolean;
    markers?: Marker[];
    bufferedValue: number
}

export interface VideoProgressState {
    isDragging: boolean;
    isHandleHovering: boolean;
    movingInfo: { progress: number; offset: number; value: number } | null;
    activeIndex: number
}

export default class VideoProgress extends BaseComponent<VideoProgressProps, VideoProgressState> {
    static defaultProps = {
        value: 0,
        onChange: noop,
        max: 100,
        showTooltip: true,
    };

    private sliderRef: React.RefObject<HTMLDivElement>;
    private handleRef: React.RefObject<HTMLDivElement>;
    private markersList: MarkerListItem[];
    foundation: VideoProgressFoundation;

    constructor(props: VideoProgressProps) {
        super(props);
        this.state = {
            isDragging: false,
            isHandleHovering: false,
            movingInfo: null,
            activeIndex: -1, // Used to determine which slider the current handle is on under the dragging state
        };

        this.sliderRef = React.createRef();
        this.handleRef = React.createRef();
        this.markersList = this.initMarkerList();
        this.foundation = new VideoProgressFoundation(this.adapter);
    }

    get adapter(): VideoProgressAdapter<VideoProgressProps, VideoProgressState> {
        return {
            ...super.adapter,
            getSliderRef: () => this.sliderRef.current,
            getMarkersList: () => this.markersList,
            setIsDragging: (isDragging: boolean) => this.setState({ isDragging }),
            setIsHandleHovering: (isHandleHovering: boolean) => this.setState({ isHandleHovering }),
            setActiveIndex: (activeIndex: number) => this.setState({ activeIndex }),
            setMovingInfo: (movingInfo: { progress: number; offset: number; value: number } | null) => this.setState({ movingInfo }),
        };
    }

    initMarkerList = () => {
        const { markers, max } = this.props;
        const hasMarkers = markers && markers.length > 0;
        const defaultMarker: MarkerListItem = {
            start: 0,
            end: max,
            left: '0',
            title: '',
            width: '100%',
        };
        const newMarkers = hasMarkers ? [...markers] : [defaultMarker];
        let markersList: MarkerListItem[] = [];
        if (hasMarkers) {
            newMarkers.forEach((marker: MarkerListItem | Marker, index: number) => {
                const end = index === newMarkers.length - 1 ? max : newMarkers[index + 1].start;
                if (!(marker.start > max || end > max)) {
                    const item = {
                        left: `${(marker.start / max) * 100}%`,
                        width: `${max ? (end - marker.start) / max * 100 : 100}%`,
                        end: end,
                        start: marker.start,
                        title: marker.title
                    };
                    markersList.push(item);
                }
            });
        } else {
            markersList.push(defaultMarker);
        }
        return markersList;
    }

    handleMouseEnter = (e: any) => {
        this.foundation.handleMouseEvent(e, false);
    }

    handleMouseMove = (e: any) => {
        this.foundation.handleMouseEvent(e, true);
    }

    renderTooltipContent = () => {
        const { movingInfo } = this.state;
        if (this.markersList.length > 0 && movingInfo) {
            const hoverIndex = this.markersList.findIndex((marker: MarkerListItem) => {
                return movingInfo?.value > marker.start && movingInfo?.value < marker.end;
            });
            return (
                <>
                    <div className={cls(`${cssClasses.PREFIX_PROGRESS}-tooltip-content`)}>
                        {this.markersList[hoverIndex]?.title}
                    </div>
                    <div className={cls(`${cssClasses.PREFIX_PROGRESS}-tooltip-content`)}>
                        {formatTime(movingInfo.progress * this.props.max)}
                    </div>
                </>
            );
        }
        return movingInfo && formatTime(movingInfo.progress * this.props.max);
    }

    render() {
        const { showTooltip, max, value: currentValue } = this.props;
        const { movingInfo, isHandleHovering, isDragging, activeIndex } = this.state;
        const sliderContent = (
            <div
                role="slider"
                tabIndex={0}
                aria-valuenow={currentValue as number}
                ref={this.sliderRef}
                className={cls(`${cssClasses.PREFIX_PROGRESS}`)}
                onMouseDown={this.foundation.handleMouseDown}
                onMouseUp={this.foundation.handleMouseUp}
                onMouseEnter={this.handleMouseEnter}
                onMouseMove={this.handleMouseMove}
            >
                <div className={cls(`${cssClasses.PREFIX_PROGRESS}-markers`)}>
                    {
                        this.markersList.map((marker: MarkerListItem, index: number) => (
                            <div
                                key={`${marker.start}-${index}`}   
                                className={cls(`${cssClasses.PREFIX_PROGRESS}-slider`,
                                    { [`${cssClasses.PREFIX_PROGRESS}-slider-active`]: index === activeIndex && isDragging }
                                )}
                                style={{ left: marker.left, width: marker.width }}
                                onMouseEnter={() => this.foundation.handleSliderMouseEnter(index)}
                                onMouseLeave={() => this.foundation.handleSliderMouseLeave(index)}
                            >
                                <div className={cls(`${cssClasses.PREFIX_PROGRESS}-slider-list`)} />
                                <div
                                    className={cls(`${cssClasses.PREFIX_PROGRESS}-slider-buffered`)}
                                    style={{ width: this.foundation.getLoadedWidth(marker) }}
                                />
                                <div
                                    className={cls(`${cssClasses.PREFIX_PROGRESS}-slider-played`)}
                                    style={{ width: this.foundation.getPlayedWidth(marker) }}
                                />
                            </div>
                        ))
                    }
                </div>
                <div
                    ref={this.handleRef}
                    className={cls(`${cssClasses.PREFIX_PROGRESS}-handle`)}
                    style={{
                        left: `calc(${((max ? (currentValue || 1) / max : 0) * 100)}% - 8px)`,
                        transform: 'translateY(-50%)',
                        opacity: (isHandleHovering || isDragging) ? 1 : 0,
                        transition: 'opacity 0.3s',
                        pointerEvents: 'none',
                    }}
                />
            </div>
        );

        return showTooltip ? (
            <Tooltip
                position={'top'}
                className={cls(`${cssClasses.PREFIX_PROGRESS}-tooltip`)}
                content={this.renderTooltipContent()}
                style={{ 'left': movingInfo?.offset }}
            >
                {sliderContent}
            </Tooltip>
        ) : sliderContent;
    }
}