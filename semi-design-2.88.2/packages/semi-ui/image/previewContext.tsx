import { createContext, ReactNode } from "react";
import { PreviewImageProps, PreviewProps } from "./interface";
export interface PreviewContextProps {
    isGroup: boolean;
    lazyLoad: boolean;
    previewSrc: string[];
    titles: ReactNode[];
    currentIndex: number;
    visible: boolean;
    previewObserver: IntersectionObserver;
    setCurrentIndex: (current: number) => void;
    handleVisibleChange: (visible: boolean, preVisible?: boolean) => void;
    setDownloadName: (src: string) => string
}

export const PreviewContext = createContext<PreviewContextProps>({} as any);




