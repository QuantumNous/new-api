import React from 'react';
import AudioPlayer from '../index';

export default {
    title: 'AudioPlayer',
};

export const DefaultAutoPlay = () => {
    const audioUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3'; // 替换为实际的音频URL
    const audioUrlArray = [
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio2.mp3',
    ];
    const audioInfo = {
        title: '音频标题',
        cover: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg',
        src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3',
    };
    const audioInfoArray = [
        {
            title: '音频标题1',
            cover: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg',
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3',
        },
        {
            title: '音频标题2',
            cover: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/sky.jpg',
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio2.mp3',
        }
    ];
    return (
        <div>
            <AudioPlayer
                autoPlay={false}
                audioUrl={audioInfoArray}
            />
        </div>
    );
};
