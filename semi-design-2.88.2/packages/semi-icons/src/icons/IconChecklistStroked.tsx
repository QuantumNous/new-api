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
                d="M7.7 2.8a1 1 0 0 1 0 1.4l-3 3a1 1 0 0 1-1.4 0L1.8 5.7a1 1 0 0 1 1.4-1.4l.8.79 2.3-2.3a1 1 0 0 1 1.4 0Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7.7 9.8a1 1 0 0 1 0 1.4l-3 3a1 1 0 0 1-1.4 0l-1.5-1.5a1 1 0 1 1 1.4-1.4l.8.79 2.3-2.3a1 1 0 0 1 1.4 0Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7.7 16.8a1 1 0 0 1 0 1.4l-3 3a1 1 0 0 1-1.4 0l-1.5-1.5a1 1 0 1 1 1.4-1.4l.8.79 2.3-2.3a1 1 0 0 1 1.4 0Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.5 12a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2h-11a1 1 0 0 1-1-1Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.5 19a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2h-11a1 1 0 0 1-1-1Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.5 5a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2h-11a1 1 0 0 1-1-1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'checklist_stroked');
export default IconComponent;
