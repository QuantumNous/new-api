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
                d="M3.5 2.5C4.33 2.5 5 3.17 5 4v6.5h6V4a1.5 1.5 0 0 1 3 0v16a1.5 1.5 0 0 1-3 0v-6.5H5V20a1.5 1.5 0 0 1-3 0V4c0-.83.67-1.5 1.5-1.5Z"
                fill="currentColor"
            />
            <path
                d="M15.47 19.87c0 .67.5 1.13 1.26 1.13h4.77c.8 0 1.28-.41 1.28-1.1 0-.7-.5-1.11-1.28-1.11h-2.3v-.11l1.62-1.44c1.09-.96 1.62-1.92 1.62-2.93 0-1.6-1.48-2.8-3.47-2.8-1.91 0-3.52 1.18-3.52 2.51 0 .6.47 1.05 1.12 1.05.46 0 .76-.18 1.18-.7.36-.45.66-.62 1.07-.62.53 0 .9.35.9.85 0 .45-.32.89-1.03 1.56l-2.09 1.97c-.84.79-1.13 1.24-1.13 1.74Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'h2');
export default IconComponent;
