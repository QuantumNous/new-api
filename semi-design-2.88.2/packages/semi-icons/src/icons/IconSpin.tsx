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
            <g clipPath="url(#clip_spin)">
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M14.2 3.79A8.5 8.5 0 0 0 5 16.81a1.5 1.5 0 1 1-2.48 1.7 11.5 11.5 0 1 1 20.6-3.53 1.5 1.5 0 0 1-2.91-.78A8.5 8.5 0 0 0 14.2 3.79Z"
                    fill="currentColor"
                />
            </g>
            <defs>
                <radialGradient
                    cx={0}
                    cy={0}
                    r={1}
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(12 12) rotate(15) scale(9.5 9.51825)"
                >
                    <stop />
                    <stop offset={0.301257} stopOpacity={0} stopColor="currentColor" />
                    <stop offset={0.466753} stopOpacity={1} stopColor="currentColor" />
                </radialGradient>
                <clipPath id="clip_spin">
                    <rect width={24} height={24} fill="currentColor" />
                </clipPath>
            </defs>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'spin');
export default IconComponent;
