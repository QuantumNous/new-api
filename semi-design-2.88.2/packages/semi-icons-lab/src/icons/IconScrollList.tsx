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
            <rect x={2.75} y={2.75} width={18.5} height={18.5} rx={3} fill="white" stroke="#AAB2BF" strokeWidth={1.5} />
            <path d="M16 2h3a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3h-3V2Z" fill="#6A6F7F" />
            <rect x={3.5} y={7} width={12.5} height={5} fill="#4CC3FA" />
            <path d="M3.5 17H16v3.5H5.5a2 2 0 0 1-2-2V17Z" fill="#DDE3E8" />
            <path d="m19 4 1.3 2.25h-2.6L19 4Z" fill="#AAB2BF" />
            <path d="M19 20.25 17.7 18h2.6L19 20.25Z" fill="#AAB2BF" />
            <rect x={18} y={8} width={2} height={6} rx={1} fill="#DDE3E8" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'scroll-list');
export default IconComponent;
