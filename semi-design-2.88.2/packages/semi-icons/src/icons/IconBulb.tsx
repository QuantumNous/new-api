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
                d="M20 9A8 8 0 1 0 4 9a8.4 8.4 0 0 0 3.44 6.61l.42 2.55a1 1 0 0 0 .99.84h6.3a1 1 0 0 0 .99-.84l.44-2.65C17.7 14.5 20 12.04 20 9ZM8.3 7.3a1 1 0 0 1 1.4 0L12 9.58l2.3-2.3a1 1 0 1 1 1.4 1.42L13 11.4v3.09a1 1 0 1 1-2 0v-3.09l-2.7-2.7a1 1 0 0 1 0-1.42Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M15 20v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1h6Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'bulb');
export default IconComponent;
