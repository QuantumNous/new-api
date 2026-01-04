import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <g clipPath="url(#clip_loading)">
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 0c.66 0 1.2.54 1.2 1.2v5.2a1.2 1.2 0 0 1-2.4 0V1.2c0-.66.54-1.2 1.2-1.2Zm7.05 2.3c.54.38.66 1.13.27 1.67l-3.06 4.2a1.2 1.2 0 0 1-1.94-1.4l3.06-4.21a1.2 1.2 0 0 1 1.67-.27Zm-14.1 0a1.2 1.2 0 0 1 1.67.26l3.06 4.2a1.2 1.2 0 1 1-1.94 1.41l-3.06-4.2a1.2 1.2 0 0 1 .27-1.68Zm-4.36 6c.2-.64.88-.98 1.5-.78l4.95 1.6a1.2 1.2 0 0 1-.74 2.3L1.36 9.8a1.2 1.2 0 0 1-.77-1.5Zm22.82 0c.2.62-.14 1.3-.77 1.5l-4.94 1.61a1.2 1.2 0 0 1-.74-2.28l4.94-1.6c.63-.21 1.3.13 1.51.76Zm-15.6 5.06c.21.63-.13 1.3-.77 1.51l-4.94 1.6a1.2 1.2 0 0 1-.74-2.27l4.94-1.61c.63-.2 1.31.14 1.52.77Zm8.37 0c.21-.63.89-.98 1.52-.77l4.94 1.6a1.2 1.2 0 0 1-.74 2.29l-4.94-1.6a1.2 1.2 0 0 1-.78-1.52Zm-6.77 2.2c.54.39.66 1.14.27 1.68l-3.06 4.2a1.2 1.2 0 1 1-1.94-1.4l3.06-4.21a1.2 1.2 0 0 1 1.67-.27Zm5.18 0a1.2 1.2 0 0 1 1.67.27l3.06 4.2a1.2 1.2 0 0 1-1.94 1.41l-3.06-4.2a1.2 1.2 0 0 1 .27-1.68ZM12 16.4c.66 0 1.2.54 1.2 1.2v5.2a1.2 1.2 0 0 1-2.4 0v-5.2c0-.66.54-1.2 1.2-1.2Z"
                    fill="currentColor"
                />
            </g>
            <defs>
                <clipPath id="clip_loading">
                    <rect width={24} height={24} fill="currentColor" />
                </clipPath>
            </defs>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'loading');
export default IconComponent;
