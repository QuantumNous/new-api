import BaseFoundation, { DefaultAdapter } from "../base/foundation";
import { isObject } from "lodash";


export interface ImageAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getIsInGroup: () => boolean
}


export default class ImageFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<ImageAdapter<P, S>, P, S> {
    constructor(adapter: ImageAdapter<P, S>) {
        super({ ...adapter });
    }

    handleClick = (e: any) => {
        const { imageID, preview } = this.getProps();
        // if preview = false, then it cannot preview
        if (!preview) {
            return;
        }
        // if image in group, then use group's Preview components
        if (this._adapter.getIsInGroup()) {
            const { setCurrentIndex, handleVisibleChange } = this._adapter.getContexts();
            setCurrentIndex(imageID);
            handleVisibleChange(true);
        } else {
            // image isn't in group, then use it's own Preview components
            this.handlePreviewVisibleChange(true);
        }
    }

    handleLoaded = (e: any) => {
        const { onLoad } = this.getProps();
        onLoad && onLoad(e);
        this.setState ({
            loadStatus: "success",
        } as any);
    }

    handleError = (e: any) => {
        const { onError } = this.getProps();
        onError && onError(e);
        this.setState ({
            loadStatus: "error",
        } as any);
    }

    handlePreviewVisibleChange = (newVisible: boolean) => {
        const { preview } = this.getProps();
        if (isObject(preview)) {
            const { onVisibleChange } = preview as any;
            onVisibleChange && onVisibleChange(newVisible);
            if (!("visible" in preview)) {
                this.setState({
                    previewVisible: newVisible,
                } as any);
            }
        } else {
            this.setState({
                previewVisible: newVisible,
            } as any);
        }
    }
}