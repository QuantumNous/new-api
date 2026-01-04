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
                d="M9 3.5c0-.83.67-1.5 1.5-1.5h7a1.5 1.5 0 0 1 0 3h-2L12 19h1.5a1.5 1.5 0 0 1 0 3h-7a1.5 1.5 0 0 1 0-3h2L12 5h-1.5A1.5 1.5 0 0 1 9 3.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'italic');
export default IconComponent;
