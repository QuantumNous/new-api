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
            <path d="M8 11H5V8h3v3Z" fill="currentColor" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M14 4a2 2 0 0 1 2 2v12a2 2 0 0 1-1.8 1.99L14 20H3l-.2-.01A2 2 0 0 1 1 18V6c0-1.1.9-2 2-2h11ZM3 18h11V6H3v12Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M21.55 6.72a1 1 0 0 1 1.45.9v8.76a1 1 0 0 1-1.45.9l-4-2a1 1 0 0 1-.55-.9V9.62a1 1 0 0 1 .55-.9l4-2ZM19 10.24v3.52l2 1V9.24l-2 1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'user_card_video_stroked');
export default IconComponent;
