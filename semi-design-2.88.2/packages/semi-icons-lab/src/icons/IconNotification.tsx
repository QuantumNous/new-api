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
            <g clipPath="url(#clip0_1_3040)">
                <circle cx={13.0623} cy={19.0623} r={2.78627} transform="rotate(-6 13.0623 19.0623)" fill="#324350" />
                <path
                    d="M11.16.96c-.99.1-1.93.71-1.83 1.7l.07.69c-2.5.93-3.66 3.42-3.37 6.2l.32 2.98c.28 2.65-1.15 3.78-2.37 5.34-.58.75.02 1.95.96 1.85l16.21-1.7c.94-.1 1.28-1.4.56-2.01-1.52-1.28-3.15-2.08-3.43-4.73l-.31-2.99c-.3-2.78-1.94-4.97-4.59-5.36l-.07-.68c-.1-1-1.15-1.4-2.15-1.29Z"
                    fill="#FBCD2C"
                />
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M18.42 4.9c-.31-.52-.84-.98-1.87-1.5a1 1 0 0 1 .9-1.78c1.19.6 2.1 1.27 2.69 2.26.58.98.79 2.15.86 3.58a1 1 0 0 1-2 .1 5.65 5.65 0 0 0-.58-2.65Z"
                    fill="#DDE3E8"
                />
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M3.35 12.68c.15-.67.11-1.4-.14-2.45a1 1 0 1 1 1.95-.46c.28 1.21.38 2.25.15 3.32a9.26 9.26 0 0 1-1.48 3.17 1 1 0 1 1-1.66-1.1 7.34 7.34 0 0 0 1.18-2.48Z"
                    fill="#DDE3E8"
                />
            </g>
            <defs>
                <clipPath id="clip0_1_3040">
                    <rect width={24} height={24} fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'notification');
export default IconComponent;
