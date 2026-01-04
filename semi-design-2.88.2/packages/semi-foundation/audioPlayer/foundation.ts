

import BaseFoundation, { DefaultAdapter } from '../base/foundation';

export interface AudioPlayerAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    init: () => void;
    resetAudioState: () => void;
    handleStatusClick: () => void;
    handleTimeUpdate: () => void;
    handleTrackChange: (direction: 'next' | 'prev') => void;
    getAudioRef: () => HTMLAudioElement;
    handleTimeChange: (value: number) => void;
    handleSpeedChange: (value: { label: string; value: number }) => void;
    handleSeek: (direction: number) => void;
    handleRefresh: () => void;
    handleVolumeChange: (value: number) => void;
    destroy: () => void
}

class AudioPlayerFoundation extends BaseFoundation<AudioPlayerAdapter> {
    constructor(adapter: AudioPlayerAdapter) {
        super({ ...AudioPlayerFoundation, ...adapter });
    }

    initAudioState() {
        const audioElement = this.getAudioRef();
        const props = this.getProps();

        this.setState({
            totalTime: audioElement?.duration || 0,
            isPlaying: props.autoPlay,
            volume: audioElement?.volume * 100 || 100,
            currentRate: { label: '1.0x', value: audioElement?.playbackRate || 1 },
        });
    }

    endHandler() {
        const props = this.getProps();
        if (Array.isArray(props.audioUrl)) {
            this.handleTrackChange('next');
        } else {
            this.setState({
                isPlaying: false,
            });
        }
    }

    errorHandler() {
        this.setState({
            error: true,
        });
    }

    init() {
        this._adapter.init();
    }

    destroy() {
        this._adapter.destroy();
    }

    resetAudioState() {
        this._adapter.resetAudioState();
    }

    handleStatusClick() {
        this._adapter.handleStatusClick();
    }

    handleTimeUpdate() {
        this._adapter.handleTimeUpdate();
    }

    handleTrackChange(direction: 'next' | 'prev') {
        this._adapter.handleTrackChange(direction);
    }

    getAudioRef() {
        return this._adapter.getAudioRef();
    }

    handleTimeChange(value: number) {
        this._adapter.handleTimeChange(value);
    }

    handleSpeedChange(value: { label: string; value: number }) {
        this._adapter.handleSpeedChange(value);
    }

    handleSeek(direction: number) {
        this._adapter.handleSeek(direction);
    }

    handleRefresh() {
        this._adapter.handleRefresh();
    }

    handleVolumeChange(value: number) {
        this._adapter.handleVolumeChange(value);
    }
}

export default AudioPlayerFoundation;
