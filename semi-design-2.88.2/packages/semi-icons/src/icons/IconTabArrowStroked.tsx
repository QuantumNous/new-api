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
                d="M2 5c0-1.1.9-2 2-2h11a1 1 0 1 1 0 2H4v14h16v-8a1 1 0 1 1 2 0v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M18.3 8.7a1 1 0 0 1 0-1.4L19.58 6l-1.3-1.3a1 1 0 0 1 1.42-1.4l2 2a1 1 0 0 1 0 1.4l-2 2a1 1 0 0 1-1.42 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'tab_arrow_stroked');
export default IconComponent;
