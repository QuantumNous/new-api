/* eslint-disable jsx-a11y/click-events-have-key-events */
import React from 'react';
import cls from 'classnames';
import BaseComponent from '../_base/baseComponent';
import { cssClasses, DEFAULT_PLAYBACK_RATE, numbers, strings } from '@douyinfe/semi-foundation/videoPlayer/constants';
import VideoPlayerFoundation, { VideoPlayerAdapter } from '@douyinfe/semi-foundation/videoPlayer/foundation';
import '@douyinfe/semi-foundation/videoPlayer/videoPlayer.scss';
import { IconPlay, IconPause, IconVolume1, IconVolume2, IconRestart, IconFlipHorizontal, IconMinimize, IconMaximize, IconMute, IconPlayCircle, IconMiniPlayer } from '@douyinfe/semi-icons';
import Button from '../button';
import Popover from '../popover';
import AudioSlider from '../audioPlayer/audioSlider';
import Dropdown from '../dropdown';
import VideoProgress from './videoProgress';
import { formatTime } from './utils';
import isNullOrUndefined from '@douyinfe/semi-foundation/utils/isNullOrUndefined';
import LocaleConsumer from '../locale/localeConsumer';
import { Locale } from '../locale/interface';
import ErrorSVG from './ErrorSvg';
import { Marker } from '@douyinfe/semi-foundation/videoPlayer/progressFoundation';

const prefixCls = cssClasses.PREFIX;

export interface VideoPlayerProps {
    autoPlay: boolean;
    captionsSrc?: string;
    className?: string;
    clickToPlay: boolean;
    controlsList?: Array<string>;
    crossOrigin?: React.MediaHTMLAttributes<HTMLVideoElement>['crossOrigin'];
    defaultPlaybackRate: number;
    defaultQuality?: string;
    defaultRoute?: string;
    height?: number | string;
    loop?: boolean;
    markers?: Marker[];
    muted: boolean;
    onPause?: () => void;
    onPlay?: () => void;
    onQualityChange?: (quality: string) => void;
    onRateChange?: (rate: number) => void;
    onRouteChange?: (route: string) => void;
    onVolumeChange?: (volume: number) => void;
    playbackRateList: { label: string; value: number }[];
    poster?: string;
    // todo: 预览缩略图
    // previewThumbnails?: boolean | Record<string, unknown>;
    qualityList?: Array<{ label: string; value: string }>;
    routeList?: Array<{ label: string; value: string }>;
    seekTime?: number;
    src?: string;
    style?: React.CSSProperties;
    theme: string;
    volume: number;
    width?: number | string
}

export interface VideoPlayerState {
    bufferedValue: number;
    currentQuality: string;
    currentRoute: string;
    currentTime: number;
    isError: boolean;
    isMirror: boolean;
    isPlaying: boolean;
    muted: boolean;
    notificationContent: string;
    playbackRate: number;
    playbackRateList: { label: string; value: number }[];
    showNotification: boolean;
    showControls: boolean;
    src: string;
    totalTime: number;
    volume: number
}

class VideoPlayer extends BaseComponent<VideoPlayerProps, VideoPlayerState> {
    static defaultProps: VideoPlayerProps = {
        autoPlay: false,
        clickToPlay: true,
        defaultPlaybackRate: numbers.DEFAULT_PLAYBACK_RATE,
        controlsList: [strings.PLAY, strings.NEXT, strings.TIME, strings.VOLUME, strings.PLAYBACK_RATE, strings.QUALITY, strings.ROUTE, strings.MIRROR, strings.FULLSCREEN, strings.PICTURE_IN_PICTURE],
        loop: false,
        muted: false,
        playbackRateList: DEFAULT_PLAYBACK_RATE,
        seekTime: numbers.DEFAULT_SEEK_TIME,
        theme: strings.DARK,
        volume: numbers.DEFAULT_VOLUME,
    };

    private videoRef: React.RefObject<HTMLVideoElement>;
    private videoWrapperRef: React.RefObject<HTMLDivElement>;
    foundation: VideoPlayerFoundation;

    constructor(props: VideoPlayerProps) {
        super(props);
        this.state = {
            bufferedValue: 0,
            currentQuality: props.defaultQuality || '',
            currentRoute: props.defaultRoute || '',
            currentTime: 0,
            isError: false,
            isMirror: false,
            isPlaying: false,
            muted: props.muted,
            notificationContent: '',
            playbackRate: props.defaultPlaybackRate || 1,
            playbackRateList: props.playbackRateList,
            showNotification: false,
            showControls: true,
            src: props.src || '',
            totalTime: 0,
            volume: props.muted ? 0 : props.volume,
        };
        this.videoRef = React.createRef();
        this.videoWrapperRef = React.createRef();
        this.foundation = new VideoPlayerFoundation(this.adapter);
    }

    get adapter(): VideoPlayerAdapter<VideoPlayerProps, VideoPlayerState> {
        return {
            ...super.adapter,
            getVideo: () => this.videoRef.current,
            getVideoWrapper: () => this.videoWrapperRef.current,
            notifyPause: () => this.props.onPause?.(),
            notifyPlay: () => this.props.onPlay?.(),
            notifyQualityChange: (quality: string) => this.props.onQualityChange?.(quality),
            notifyRateChange: (rate: number) => this.props.onRateChange?.(rate),
            notifyRouteChange: (route: string) => this.props.onRouteChange?.(route),
            notifyVolumeChange: (volume: number) => this.props.onVolumeChange?.(volume),
            setBufferedValue: (bufferedValue: number) => this.setState({ bufferedValue }),
            setCurrentTime: (currentTime: number) => this.setState({ currentTime }),
            setIsError: (isError: boolean) => this.setState({ isError }),
            setIsMirror: (isMirror: boolean) => this.setState({ isMirror }),
            setIsPlaying: (isPlaying: boolean) => this.setState({ isPlaying }),
            setMuted: (muted: boolean) => this.setState({ muted }),
            setNotificationContent: (content: string) => this.setState({ notificationContent: content }),
            setPlaybackRate: (rate: number) => this.setState({ playbackRate: rate }),
            setQuality: (quality: string) => this.setState({ currentQuality: quality }),
            setRoute: (route: string) => this.setState({ currentRoute: route }),
            setShowControls: (showControls: boolean) => this.setState({ showControls }),
            setShowNotification: (showNotification: boolean) => this.setState({ showNotification: showNotification }),
            setTotalTime: (totalTime: number) => this.setState({ totalTime }),
            setVolume: (volume: number) => this.setState({ volume }),
        };
    }

    static getDerivedStateFromProps(props: VideoPlayerProps, state: VideoPlayerState): Partial<VideoPlayerState> {
        const states: Partial<VideoPlayerState> = {};
        if (!isNullOrUndefined(props.src) && props.src !== state.src) {
            states.src = props.src;
        }
        return states;
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    handleMouseEnterWrapper = () => {
        this.foundation.handleMouseEnterWrapper();
    }

    handleMouseLeaveWrapper = () => {
        this.foundation.handleMouseLeaveWrapper();
    }

    handleTimeChange = (value: number) => {
        this.foundation.handleTimeChange(value);
    }

    handleTimeUpdate = () => {
        this.foundation.handleTimeUpdate();
    }

    handleError = () => {
        this.foundation.handleError();
    }

    handlePlay = () => {
        this.foundation.handlePlay();
    }

    handlePause = () => {
        this.foundation.handlePause();
    }

    handleCanPlay = () => {
        this.foundation.handleCanPlay();
    }

    handleWaiting = (locale: Locale['VideoPlayer']) => {
        this.foundation.handleWaiting(locale);
    }

    handleStalled = (locale: Locale['VideoPlayer']) => {
        this.foundation.handleStalled(locale);
    }

    handleProgress = () => {
        this.foundation.handleProgress();
    }

    handleEnded = () => {
        this.foundation.handleEnded();
    }

    handleDurationChange = () => {
        this.foundation.handleDurationChange();
    }

    handleVolumeChange = (value: number) => {
        this.foundation.handleVolumeChange(value);
    }

    handleVolumeSilent = () => {
        this.foundation.handleVolumeSilent();
    }

    handleRateChange = (option: { label: string; value: number }, locale: Locale['VideoPlayer']) => {
        this.foundation.handleRateChange(option, locale);
    }

    handleQualityChange = (option: { label: string; value: string }, locale: Locale['VideoPlayer']) => {
        this.foundation.handleQualityChange(option, locale);
    }

    handleRouteChange = (option: { label: string; value: string }, locale: Locale['VideoPlayer']) => {
        this.foundation.handleRouteChange(option, locale);
    }
    
    handleMirror = (locale: Locale['VideoPlayer']) => {
        this.foundation.handleMirror(locale);
    }

    handleFullscreen = () => {
        this.foundation.handleFullscreen();
    }

    handlePictureInPicture = () => {
        this.foundation.handlePictureInPicture();
    }

    getVolumeIcon = () => {
        const { volume, muted } = this.state;
        if (muted) {
            return <IconMute />;
        }
        if (volume < 50) {
            return <IconVolume1 />;
        }
        return <IconVolume2 />;
    }

    isResourceNotFound = () => {
        const { src } = this.props;
        return isNullOrUndefined(src);
    }

    renderTime = () => {
        const { currentTime, totalTime } = this.state;
        if (this.foundation.shouldShowControlItem(strings.TIME)) {
            return <div className={cls(`${cssClasses.PREFIX_CONTROLS}-time`)}>
                {formatTime(currentTime)} / {formatTime(totalTime)}
            </div>;
        }
        return null;
    }

    renderResourceNotFound = (locale: Locale['VideoPlayer']) => {
        return (
            <div className={cls(`${prefixCls}-resource-not-found`)}>
                {locale.noResource}
            </div>
        );
    }

    renderPauseIcon = () => {
        const { isPlaying, isError } = this.state;
        if (!isPlaying && !isError) {
            return (
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                <div className={cls(`${prefixCls}-pause`)} >
                    <IconPlayCircle />
                </div>
            );
        }
        return null;
    }

    renderError = (locale: Locale['VideoPlayer']) => {
        const { isError } = this.state;
        const { theme } = this.props;
        if (isError) {
            return (
                <div className={cls(`${prefixCls}-error`, 
                    { [`${prefixCls}-error-${theme}`]: theme })}
                >
                    <div className={cls(`${prefixCls}-error-svg`)}>
                        <ErrorSVG />
                    </div>
                    {locale.videoError}
                </div>
            );
        }
        return null;
    }

    renderPoster = () => {
        const { poster } = this.props;
        const { isPlaying, currentTime, totalTime } = this.state;
        const isHide = currentTime > 0 && currentTime < totalTime;
        if (!isPlaying && poster) {
            return (
                <img 
                    className={cls(`${prefixCls}-poster`, 
                        { [`${prefixCls}-poster-hide`]: isHide }
                    )}
                    src={poster} 
                    alt="poster" 
                />
            );
        }
        return null;
    }

    renderNotification = () => {
        const { showNotification, notificationContent } = this.state;

        if (!showNotification || !notificationContent) {
            return null;
        }

        return (
            <div className={cls(`${prefixCls}-notification`)}>
                {this.state.notificationContent}
            </div>
        );
    }

    renderVolume = () => {
        const { volume, muted } = this.state;
        if (this.foundation.shouldShowControlItem(strings.VOLUME)) {
            return (
                <Popover 
                    autoAdjustOverflow
                    position='top'
                    className={cls(`${cssClasses.PREFIX_CONTROLS}-popover`)}
                    content={
                        <div className={cls(`${cssClasses.PREFIX_CONTROLS}-volume`)}>
                            <div className={cls(`${cssClasses.PREFIX_CONTROLS}-volume-title`)}>{muted ? 0 : volume}%</div>
                            <AudioSlider 
                                value={muted ? 0 : volume} 
                                max={100} 
                                vertical 
                                height={120} 
                                showTooltip={false} 
                                onChange={this.handleVolumeChange} 
                            />
                        </div>
                    }
                >
                    <Button
                        className={cls(
                            `${cssClasses.PREFIX_CONTROLS}-menu-item`, 
                            `${cssClasses.PREFIX_CONTROLS}-menu-button`)
                        }
                        theme={'borderless'}
                        icon={this.getVolumeIcon()}
                        onClick={this.handleVolumeSilent}
                    />
                </Popover>
            );
        }
        return null;
    }

    renderIconButton = (icon: React.ReactNode, onClick: () => void, name: string) => {
        if (!this.foundation.shouldShowControlItem(name)) {
            return null;
        }
        return (
            <Button
                theme={'borderless'}
                className={cls(
                    `${cssClasses.PREFIX_CONTROLS}-menu-item`, 
                    `${cssClasses.PREFIX_CONTROLS}-menu-button`
                )}
                icon={icon}
                onClick={onClick}
            />
        );
    }

    renderDropdownButton = (currentValue: string | number, list: { label: string; value: number | string }[], handleChange: (option: { label: string; value: any }, locale: Locale['VideoPlayer']) => void, name: string, locale: Locale['VideoPlayer']) => {
        if (this.foundation.shouldShowControlItem(name)) {
            return (
                <Dropdown 
                    position='top'
                    className={cls(`${cssClasses.PREFIX_CONTROLS}-popup-menu`)} 
                    render={
                        <Dropdown.Menu>
                            {list.map((option) => (
                                <Dropdown.Item 
                                    className={cls(`${cssClasses.PREFIX_CONTROLS}-popup-menu-item`)} 
                                    key={option.value} 
                                    onClick={() => handleChange(option, locale)} 
                                    active={option.value === currentValue}
                                >
                                    {option.label}
                                </Dropdown.Item>
                            ))}
                        </Dropdown.Menu>
                    } 
                    onChange={(option: { label: string; value: any }) => handleChange(option, locale)}
                >
                    <div 
                        className={cls(
                            `${cssClasses.PREFIX_CONTROLS}-menu-item`, 
                            `${cssClasses.PREFIX_CONTROLS}-popup`)
                        }
                    >
                        {list.find((option) => option.value === currentValue)?.label}
                    </div>
                </Dropdown>
            );
        }
        return null;
    }

    render() {
        const { markers, qualityList, routeList, width, height, autoPlay, style, className, loop, captionsSrc, crossOrigin, theme } = this.props;
        const { isPlaying, playbackRate, playbackRateList, isMirror, currentTime, totalTime, currentQuality, currentRoute, src, bufferedValue, showControls } = this.state;

        return (
            <LocaleConsumer componentName="VideoPlayer">
                {(locale: Locale['VideoPlayer']) => { 
                    return (
                        <div 
                            className={cls(`${prefixCls}`,
                                className,
                                { [`${prefixCls}-mirror`]: isMirror },
                            )}
                            style={{ width, height, ...style }}
                            ref={this.videoWrapperRef}
                            onMouseEnter={this.handleMouseEnterWrapper}
                            onMouseLeave={this.handleMouseLeaveWrapper} 
                        >
                            <div className={cls(`${prefixCls}-wrapper`,
                                { [`${cssClasses.PREFIX}-wrapper-${theme}`]: theme }
                            )}>
                                <video 
                                    ref={this.videoRef} 
                                    autoPlay={autoPlay}
                                    loop={loop}
                                    controls={false}
                                    crossOrigin={crossOrigin}
                                    src={src}
                                    onTimeUpdate={this.handleTimeUpdate}
                                    onDurationChange={this.handleDurationChange}
                                    onClick={() => { this.foundation.handlePlayOrPause();}}
                                    // An error occurred while getting the media data, or the resource is in an unsupported format.
                                    onError={this.handleError}
                                    onCanPlay={this.handleCanPlay}
                                    // Playback stopped due to temporary lack of data.
                                    onWaiting={() => this.handleWaiting(locale)}
                                    // The user agent attempted to fetch media data but was unexpectedly unable to fetch the data.
                                    onStalled={() => this.handleStalled(locale)}
                                    onProgress={this.handleProgress}
                                    onEnded={this.handleEnded}
                                >
                                    <track kind="captions" src={captionsSrc}/>
                                </video>
                                {this.isResourceNotFound() && this.renderResourceNotFound(locale)}
                            </div>
                            {this.renderPoster()}
                            {this.renderPauseIcon()}
                            {this.renderError(locale)}
                            {this.renderNotification()}
                            <div className={cls(`${cssClasses.PREFIX_CONTROLS}`,
                                { [`${cssClasses.PREFIX_CONTROLS}-hide`]: !showControls }
                            )}>
                                <VideoProgress 
                                    key={totalTime}
                                    value={currentTime} 
                                    max={totalTime} 
                                    onChange={this.handleTimeChange}
                                    markers={markers}
                                    bufferedValue={bufferedValue}
                                />
                                <div className={cls(`${cssClasses.PREFIX_CONTROLS}-menu`)}>
                                    <div className={cls(`${cssClasses.PREFIX_CONTROLS}-menu-left`)}>
                                        {this.renderIconButton(isPlaying ? <IconPause /> : <IconPlay />, isPlaying ? this.handlePause : this.handlePlay, strings.PLAY)}
                                        {this.renderIconButton(<IconRestart rotate={180} />, isPlaying ? this.handlePause : this.handlePlay, strings.NEXT)}
                                        {this.renderTime()}
                                        {this.renderVolume()}
                                        {this.renderDropdownButton(playbackRate, playbackRateList, this.handleRateChange, strings.PLAYBACK_RATE, locale)}
                                    </div>
                                    <div className={cls(`${cssClasses.PREFIX_CONTROLS}-menu-right`)}>
                                        {qualityList && qualityList.length > 0 && this.renderDropdownButton(currentQuality, qualityList, this.handleQualityChange, strings.QUALITY, locale)}
                                        {routeList && routeList.length > 0 && this.renderDropdownButton(currentRoute, routeList, this.handleRouteChange, strings.ROUTE, locale)}
                                        {this.renderIconButton(<IconFlipHorizontal />, () => this.handleMirror(locale), strings.MIRROR)}
                                        {this.renderIconButton(this.foundation.checkFullScreen() ? <IconMinimize /> : <IconMaximize />, this.handleFullscreen, strings.FULLSCREEN)}
                                        {this.renderIconButton(<IconMiniPlayer />, this.handlePictureInPicture, strings.PICTURE_IN_PICTURE)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }}
            </LocaleConsumer>
        );
    }
}

export default VideoPlayer; 