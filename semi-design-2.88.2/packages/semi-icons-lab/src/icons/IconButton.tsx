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
            <path d="M2 16.5A2.5 2.5 0 0 1 4.5 14h15a2.5 2.5 0 0 1 0 5h-15A2.5 2.5 0 0 1 2 16.5Z" fill="#6A6F7F" />
            <rect x={8} y={12} width={8} height={2} fill="#DDE3E8" />
            <path
                d="M6 5.67c0-.93.65-1.74 1.58-1.87a33.07 33.07 0 0 1 8.84 0c.93.13 1.58.94 1.58 1.87V11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5.67Z"
                fill="#F82C2C"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'button');
export default IconComponent;
