import React from 'react';
import AudioPlayer from '../index';

// Define interface for audio info object
interface AudioInfo {
    title: string;
    cover: string;
    src: string;
}

export default {
    title: 'AudioPlayer',
};

export const DefaultAutoPlay: React.FC = () => {
    const audioUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3'; // 替换为实际的音频URL
    const audioUrlArray = [
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio2.mp3',
    ];
    const audioInfo: AudioInfo = {
        title: '音频标题',
        cover: 'https://picsum.photos/50/50',
        src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3',
    };
    const audioInfoArray: AudioInfo[] = [
        {
            title: '音频标题1',
            cover: 'https://picsum.photos/50/50',
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio1.mp3',
        },
        {
            title: '音频标题2',
            cover: 'https://picsum.photos/100/100',
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio2.mp3',
        },
        {
            title: '音频标题3',
            cover: 'https://picsum.photos/150/150',
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/components/audio2.mp3',
        },
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
    