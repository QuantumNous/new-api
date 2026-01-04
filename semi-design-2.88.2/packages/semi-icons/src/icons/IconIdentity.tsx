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
                d="M4 4a1 1 0 0 1 1-1h1.38a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4Zm5.63 0a1 1 0 0 1 1-1h4.62a5.63 5.63 0 0 1 5.63 5.63v6.74A5.62 5.62 0 0 1 15.25 21h-4.63a1 1 0 0 1-1-1V4Zm7.87 11.38V8.62a2.25 2.25 0 0 0-2.25-2.24H13v11.25h2.25a2.25 2.25 0 0 0 2.25-2.25Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'identity');
export default IconComponent;
