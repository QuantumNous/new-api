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
            <g clipPath="url(#clip0_1_3049)">
                <path
                    d="M7.93 5.5a.83.83 0 0 1 1.36-.28l3.62 3.62 5.13.27c.6.03.98.68.7 1.22l-2.37 4.52 1.3 4.88a.83.83 0 0 1-.96 1.03l-5.1-1-4.25 2.96a.83.83 0 0 1-1.3-.56l-.76-4.99-3.98-3.2a.83.83 0 0 1 .15-1.4l4.6-2.3L7.93 5.5Z"
                    fill="#FBCD2C"
                />
                <path
                    d="M19.94 1.14c.2-.16.5-.06.57.19l.55 2.14 1.85 1.22c.22.15.22.47 0 .6l-1.87 1.18-.58 2.1a.36.36 0 0 1-.59.17L18.2 7.25l-2.24.17a.36.36 0 0 1-.36-.49l.8-2.02-.77-2.07c-.1-.24.1-.5.36-.48l2.21.15 1.74-1.37Z"
                    fill="#DDE3E8"
                />
            </g>
            <defs>
                <clipPath id="clip0_1_3049">
                    <rect width={24} height={24} fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'rating');
export default IconComponent;
