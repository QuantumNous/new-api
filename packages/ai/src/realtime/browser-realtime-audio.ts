import {
  decodeRealtimeAudio,
  encodeRealtimeAudio,
  resampleAudio,
} from './audio-utils';

export type BrowserRealtimeAudioOptions = {
  captureSampleRate: number;
  playbackSampleRate: number;
  onAudio: (base64Audio: string) => void;
  onPlayingChange: (isPlaying: boolean) => void;
  onCapturingChange: (isCapturing: boolean) => void;
};

export class BrowserRealtimeAudio {
  private readonly captureSampleRate: number;
  private readonly playbackSampleRate: number;
  private readonly onAudio: BrowserRealtimeAudioOptions['onAudio'];
  private readonly onPlayingChange: BrowserRealtimeAudioOptions['onPlayingChange'];
  private readonly onCapturingChange: BrowserRealtimeAudioOptions['onCapturingChange'];

  private captureContext: AudioContext | null = null;
  private captureProcessor: ScriptProcessorNode | null = null;
  private captureSource: MediaStreamAudioSourceNode | null = null;
  private captureStream: MediaStream | null = null;

  private playbackContext: AudioContext | null = null;
  private playbackQueue: Float32Array[] = [];
  private playbackTime = 0;
  private playbackStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private isPlaying = false;

  constructor(options: BrowserRealtimeAudioOptions) {
    this.captureSampleRate = options.captureSampleRate;
    this.playbackSampleRate = options.playbackSampleRate;
    this.onAudio = options.onAudio;
    this.onPlayingChange = options.onPlayingChange;
    this.onCapturingChange = options.onCapturingChange;
  }

  ensurePlaybackContext(): void {
    if (this.playbackContext == null) {
      this.playbackContext = new AudioContext({
        sampleRate: this.playbackSampleRate,
      });
    }
  }

  startCapture(stream: MediaStream): void {
    const ctx = new AudioContext({ sampleRate: this.captureSampleRate });
    this.captureContext = ctx;
    this.captureStream = stream;

    const source = ctx.createMediaStreamSource(stream);
    this.captureSource = source;

    const processor = ctx.createScriptProcessor(4096, 1, 1);
    this.captureProcessor = processor;

    processor.onaudioprocess = event => {
      const inputData = event.inputBuffer.getChannelData(0);
      const samples = resampleAudio(
        new Float32Array(inputData),
        ctx.sampleRate,
        this.captureSampleRate,
      );
      this.onAudio(encodeRealtimeAudio(samples));
    };

    source.connect(processor);
    processor.connect(ctx.destination);
    this.onCapturingChange(true);
  }

  stopCapture(): void {
    this.captureProcessor?.disconnect();
    this.captureSource?.disconnect();
    void this.captureContext?.close();
    this.captureStream?.getTracks().forEach(track => track.stop());

    this.captureProcessor = null;
    this.captureSource = null;
    this.captureContext = null;
    this.captureStream = null;
    this.onCapturingChange(false);
  }

  playAudio(base64Audio: string): void {
    this.ensurePlaybackContext();
    this.playbackQueue.push(decodeRealtimeAudio(base64Audio));
    this.schedulePlayback();
  }

  stopPlayback(): void {
    this.playbackQueue = [];

    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Source may already be stopped by the browser.
      }
    }
    this.activeSources.clear();

    if (this.playbackContext != null) {
      this.playbackTime = this.playbackContext.currentTime;
    }
    this.setPlaying(false);
  }

  getPlaybackOffsetMs(): number {
    const ctx = this.playbackContext;
    if (ctx == null) return 0;
    return (ctx.currentTime - this.playbackStartTime) * 1000;
  }

  dispose(): void {
    this.stopCapture();
    this.stopPlayback();
    void this.playbackContext?.close();
    this.playbackContext = null;
  }

  private setPlaying(isPlaying: boolean): void {
    if (isPlaying && !this.isPlaying) {
      this.playbackStartTime = this.playbackContext?.currentTime ?? 0;
    }
    if (this.isPlaying !== isPlaying) {
      this.isPlaying = isPlaying;
      this.onPlayingChange(isPlaying);
    }
  }

  private schedulePlayback(): void {
    const ctx = this.playbackContext;
    if (ctx == null || this.playbackQueue.length === 0) return;

    while (this.playbackQueue.length > 0) {
      const samples = this.playbackQueue.shift()!;
      const buffer = ctx.createBuffer(
        1,
        samples.length,
        this.playbackSampleRate,
      );
      buffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const startTime = Math.max(this.playbackTime, ctx.currentTime);
      source.start(startTime);
      this.playbackTime = startTime + buffer.duration;

      this.activeSources.add(source);
      this.setPlaying(true);

      source.onended = () => {
        this.activeSources.delete(source);
        if (this.playbackQueue.length === 0 && this.activeSources.size === 0) {
          this.setPlaying(false);
        }
      };
    }
  }
}
