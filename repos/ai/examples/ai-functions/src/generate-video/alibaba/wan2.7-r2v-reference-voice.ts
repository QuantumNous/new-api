import { alibaba, type AlibabaVideoModelOptions } from '@ai-sdk/alibaba';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating reference-to-video with voice references (wan2.7-r2v)...',
    () =>
      generateVideo({
        model: alibaba.video('wan2.7-r2v'),
        prompt:
          'Image 1 and Video 1 stand side by side and introduce themselves to the camera',
        resolution: '1920x1080',
        duration: 6,
        providerOptions: {
          alibaba: {
            // referenceVoice sets a character's voice from an audio clip
            // (wav/mp3, 1-10 seconds, public URL). It does not determine
            // the spoken content, which comes from the prompt.
            media: [
              {
                type: 'reference_image',
                url: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260408/sjuytr/wan-r2v-object-girl.jpg',
                referenceVoice:
                  'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260408/gbqewz/wan-r2v-girl-voice.mp3',
              },
              {
                type: 'reference_video',
                url: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260129/qigswt/wan-r2v-role2.mp4',
                referenceVoice:
                  'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260408/isllrq/wan-r2v-boy-voice.mp3',
              },
            ],
            ratio: '16:9',
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies AlibabaVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
