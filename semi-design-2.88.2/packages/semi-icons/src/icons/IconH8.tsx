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
                d="M18.62 19.35c-.72 0-1.23-.48-1.23-1.15 0-.67.51-1.14 1.23-1.14s1.24.48 1.24 1.14c0 .67-.52 1.15-1.24 1.15Zm0-4.05c-.58 0-1-.41-1-.96 0-.56.42-.97 1-.97.58 0 1.01.41 1.01.97 0 .55-.43.96-1.01.96Zm0 5.9c2.5 0 4.1-1.07 4.1-2.75 0-1.21-.8-2.1-2.06-2.28V16c1.14-.32 1.7-1 1.7-2.06 0-1.47-1.5-2.44-3.74-2.44s-3.73.97-3.73 2.44c0 1.05.55 1.74 1.7 2.06v.16c-1.28.19-2.08 1.07-2.08 2.28 0 1.68 1.6 2.76 4.1 2.76Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'h8');
export default IconComponent;
