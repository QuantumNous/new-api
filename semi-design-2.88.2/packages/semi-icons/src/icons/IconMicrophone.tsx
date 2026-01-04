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
            <path d="M7.5 5.5a4.5 4.5 0 0 1 9 0v6a4.5 4.5 0 1 1-9 0v-6Z" fill="currentColor" />
            <path
                d="M5 10.5a1 1 0 0 1 1 1 6 6 0 0 0 12 0 1 1 0 1 1 2 0 8 8 0 1 1-16 0 1 1 0 0 1 1-1Z"
                fill="currentColor"
            />
            <path d="M8 21a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Z" fill="currentColor" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'microphone');
export default IconComponent;
