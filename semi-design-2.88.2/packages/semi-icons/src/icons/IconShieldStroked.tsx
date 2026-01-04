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
                d="m3 4.13 9-1.63 9 1.63v5.39c0 5.66-3.62 10.69-9 12.48-5.37-1.8-9-6.82-9-12.49V4.13Z"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
            />
            <path
                d="M11.97 7.47v8"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M7.97 11.47h8"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'shield_stroked');
export default IconComponent;
