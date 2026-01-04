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
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.6 2.2a1 1 0 1 0-1.2 1.6L9 5H6.5C5.67 5 5 5.67 5 6.5v9c0 .83.67 1.5 1.5 1.5h11c.83 0 1.5-.67 1.5-1.5v-9c0-.83-.67-1.5-1.5-1.5H15l1.6-1.2a1 1 0 1 0-1.2-1.6L12 4.75 8.6 2.2ZM7 15V7h10v8H7Zm-1.5 4a.5.5 0 0 0-.5.5v1c0 .28.22.5.5.5h13a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-13ZM1 15a1 1 0 0 1 1-1h1.5c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5H3v4.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V15Zm19.5 1h.5v4.5c0 .28.22.5.5.5h1a.5.5 0 0 0 .5-.5V15a1 1 0 0 0-1-1h-1.5a.5.5 0 0 0-.5.5v1c0 .28.22.5.5.5Zm-4.8-7.7a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4 0l-2-2a1 1 0 1 1 1.4-1.4l1.3 1.29 3.3-3.3a1 1 0 0 1 1.4 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'vote_video_stroked');
export default IconComponent;
