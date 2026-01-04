import BaseFoundation, { DefaultAdapter } from '../base/foundation';

export interface MarkerListItem {
    start: number;
    end: number;
    title: string;
    width: string;
    left: string
}

export interface Marker {
    start: number;
    title: string
}

export interface VideoProgressAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getSliderRef: () => HTMLDivElement | null;
    getMarkersList: () => MarkerListItem[];
    setIsDragging: (isDragging: boolean) => void;
    setIsHandleHovering: (isHandleHovering: boolean) => void;
    setActiveIndex: (activeIndex: number) => void;
    setMovingInfo: (movingInfo: { progress: number; offset: number; value: number } | null) => void
}

export default class VideoProgressFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<VideoProgressAdapter<P, S>, P, S> {
    constructor(adapter: VideoProgressAdapter<P, S>) {
        super({ ...adapter });
    }

    handleDocumentMouseMove = (e: MouseEvent) => {
        const { isDragging } = this.getStates();
        if (isDragging) {
            this.handleMouseEvent(e, true);
        }
    };

    handleDocumentMouseUp = () => {
        const { isDragging } = this.getStates();
        if (isDragging) {
            this._adapter.setIsDragging(false);
        }
        document.removeEventListener('mousemove', this.handleDocumentMouseMove);
        document.removeEventListener('mouseup', this.handleDocumentMouseUp);
    };

    handleMouseDown = (e: any) => {
        this._adapter.setIsDragging(true);
        this.handleMouseEvent(e, true);
        document.addEventListener('mousemove', this.handleDocumentMouseMove);
        document.addEventListener('mouseup', this.handleDocumentMouseUp);
    };

    handleMouseUp = () => {
        const { isDragging } = this.getStates();
        if (isDragging) {
            this._adapter.setIsDragging(false);
        }
    };

    handleMouseEvent = (e: any, shouldSetValue: boolean = true) => {
        const { isDragging } = this.getStates();
        const { onChange, max } = this.getProps();
        const sliderRef = this._adapter.getSliderRef();
        if (!sliderRef) return;
        const rect = sliderRef.getBoundingClientRect();
        const offset = (e.clientX - rect.left);
        const total = rect.width;
        const percentage = Math.min(Math.max(offset / total, 0), 1);
        const value = percentage * max;
        
        if (shouldSetValue && (isDragging || e.type === 'mousedown')) {
            this.setActiveIndex(value);
            onChange(value);
        }

        this._adapter.setMovingInfo({
            progress: percentage,
            offset: offset - rect.width / 2,
            value
        });
    };

    handleSliderMouseEnter = (index: number) => {
        const { value: currentValue } = this.getProps();
        const markersList = this._adapter.getMarkersList();
        const currentSlider = markersList[index];
        if (currentSlider.start < currentValue && currentSlider.end > currentValue) {
            this._adapter.setIsHandleHovering(true);
        } else {
            this._adapter.setIsHandleHovering(false);
        }
    }

    handleSliderMouseLeave = (index: number) => {
        const { value: currentValue } = this.getProps();
        const markersList = this._adapter.getMarkersList();
        const currentSlider = markersList[index];
        if (currentSlider.start < currentValue && currentSlider.end > currentValue) {
            this._adapter.setIsHandleHovering(false);
        }
    }

    setActiveIndex = (currentValue: number) => {
        const markersList = this._adapter.getMarkersList();
        markersList.map((marker: MarkerListItem, index: number) => {
            if (currentValue < marker.end && currentValue > marker.start) {
                this._adapter.setIsHandleHovering(true);
                this._adapter.setActiveIndex(index);
            }
        });
    }

    getValueWidth = (marker: MarkerListItem, value: number) => {
        const { start, end } = marker;
        if (value > end) {
            return 'calc(100% - 2px)';
        } else if (value < start) {
            return '0%';
        } else {
            return `${(value - start) / (end - start) * 100}%`;
        }
    }

    // Get the width of the video being played
    getPlayedWidth = (marker: MarkerListItem) => {
        const { value: currentValue } = this.getProps();
        return this.getValueWidth(marker, currentValue);
    }

    getLoadedWidth = (marker: MarkerListItem) => {
        const { bufferedValue } = this.getProps();
        return this.getValueWidth(marker, bufferedValue);
    }


}   