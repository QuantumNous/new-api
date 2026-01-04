import React, { useState } from 'react';
import { VideoPlayer, Select, Typography } from '@douyinfe/semi-ui';

export default {
    title: 'VideoPlayer',
};

export const BasicUsage = () => {
    return (
        <div>
            <VideoPlayer 
                src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4'}
                poster={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg'}
                width={'500px'}
                height={'280px'} 
                onPause={() => {
                    console.log('pause');
                }}
                onPlay={() => {
                    console.log('play');
                }}
            />
        </div>
    )
}

// 设置菜单栏功能
export const ControlList = () => {
    return (
        <div>
            <VideoPlayer 
                width={'500px'}
                height={'280px'} 
                src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4'}
                poster={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg'}
                controlsList={['play', 'time', 'volume', 'playbackRate', 'fullscreen',]}
            />
        </div>
    )
}

export const Theme = () => {
    return (
        <div>
            <Typography.Title heading={3} style={{ margin: '8px 0' }} >dark theme</Typography.Title>
            <VideoPlayer 
                src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4'}
                poster={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg'}
                width={'1000px'}
                height={'450px'} 
                controlsList={['play', 'time', 'volume', 'playbackRate', 'fullscreen',]}
            />
            <br />
            <Typography.Title heading={3} style={{ margin: '8px 0' }} >light theme</Typography.Title>
            <VideoPlayer 
                src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4'}
                poster={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg'}
                width={'1000px'}
                height={'450px'} 
                theme={'light'}
                controlsList={['play', 'time', 'volume', 'playbackRate', 'fullscreen',]}
            />
        </div>
    )
}

export const SetSeekTime = () => {
    const [seekTime, setSeekTime] = useState(5);
    return (
        <div>
            <span style={{ marginBottom: 10 }}>请选择快进快退时间</span>
            <Select
                value={seekTime}
                style={{ width: 100, marginLeft: 10 }}
                onChange={(value) => setSeekTime(value)}
                optionList={[
                    { label: '5s', value: 5 },
                    { label: '10s', value: 10 },
                    { label: '15s', value: 15 },
                ]}
                placeholder='请选择快进快退时间'
            />
            <br />
            <VideoPlayer 
                width={'500px'}
                height={'280px'} 
                src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4'}
                poster={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg'}
                seekTime={seekTime}
                style={{ marginTop: 10 }}
            />
        </div>
    )
}

export const playbackRateList = () => {
    return (
        <div>
            <VideoPlayer 
                width={'500px'}
                height={'280px'} 
                playbackRateList={[
                    { label: '0.5x', value: 0.5 },
                    { label: '1.0x', value: 1 },
                    { label: '1.5x', value: 1.5 },
                    { label: '2.0x', value: 2 },
                ]}
                src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4'}
                poster={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg'}
            />
        </div>
    )
}

// 音量设置
export const Volume = () => {
    const src = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4";
    const poster = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg";
    return (
        <VideoPlayer 
            width={'500px'}
            height={'280px'} 
            src={src}
            poster={poster}
            muted={true}
            volume={0}
        />
    );
}

export const NoResource = () => {
    return (
        <div>
            <Typography.Title heading={3} style={{ margin: '8px 0' }} >dark theme</Typography.Title>
            <VideoPlayer 
                width={'500px'}
                height={'280px'} 
                src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-videoss.mp4'}
                poster={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg'}
            />
            <br />
            <Typography.Title heading={3} style={{ margin: '8px 0' }} >light theme</Typography.Title>
            <VideoPlayer 
                src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-videoss.mp4'}
                poster={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg'}
                theme={'light'}
                width={'500px'}
                height={'280px'} 
            />
        </div>
    )
}


// 分章节
export const Chapter = () => {
    return (
        <div>
            <VideoPlayer 
                width={'800px'}
                height={'450px'} 
                src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4'}
                poster={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg'}
                markers={[
                    {
                        start: 0,
                        title: '片头'
                    },
                    {
                        start: 4,
                        title: '功能介绍'
                    },
                    {
                        start: 38,
                        title: 'Figma Plugin'
                    },
                    {
                        start: 51,
                        title: '片尾'
                    }
                ]}
            />
        </div>
    )
}

// 清晰度和线路调整
export const QualityAndLine = () => {
    const [quality, setQuality] = useState('1080p');
    const [route, setRoute] = useState('线路1');
    const [src, setSrc] = useState('https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4');

    const playList = [
        {
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4',
            quality: '1080p',
            route: '线路1',
        },
        {
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/video/vchart-show-video-480p.mp4',
            quality: '480p',
            route: '线路1',
        },
        {
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4',
            quality: '1080p',
            route: '线路2',
        },
        {
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/video/vchart-show-video-480p.mp4',
            quality: '480p',
            route: '线路2',
        }
    ]

    const updateVideoSource = (quality, route) => {
        const source = playList.find((item) => item.quality === quality && item.route === route);
        console.log('updateVideoSource', quality, route, source);
        setSrc(source.src);
    }

    return (
        <div>
            <VideoPlayer 
                src={src}
                width={'800px'}
                height={'450px'} 
                poster={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg'}
                defaultQuality={'1080p'}
                defaultRoute={'线路1'}
                qualityList={[
                    { label: '1080p', value: '1080p' },
                    { label: '480p', value: '480p' },
                ]}
                routeList={[
                    { label: '线路1', value: '线路1' },
                    { label: '线路2', value: '线路2' },
                ]}
                onQualityChange={(quality) => {
                    console.log('quality change', quality);
                    updateVideoSource(quality, route);
                    setQuality(quality);
                }}
                onRouteChange={(route) => {
                    console.log('route change', route);
                    updateVideoSource(quality, route);
                    setRoute(route);
                }}
            />
        </div>
    )
}

export const ScrollDemo = () => {
    return (
        <div>
            滑动到底部全屏后，取消全屏，check 页面滚动是否符合预期
            <div style={{ marginTop: 1000, overflow: 'auto' }}>
                <VideoPlayer 
                    src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/landingPage/vchart-show-video.mp4'}
                    poster={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/poster2.jpeg'}
                    theme={'light'}
                    width={500}
                    height={280}
                />
            </div>
        </div>
    )
}


