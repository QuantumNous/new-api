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
            <g clipPath="url(#clip_triangle_arrow)">
                <path d="M24 9v1c-4 0-5.5 1-7.5 3S14 16 12 16s-2.5-1-4.5-3S4 10 0 10V9h24Z" fill="currentColor" />
            </g>
            <defs>
                <clipPath id="clip_triangle_arrow">
                    <rect width={24} height={24} fill="currentColor" transform="translate(24) rotate(90)" />
                </clipPath>
            </defs>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'triangle_arrow');
export default IconComponent;
