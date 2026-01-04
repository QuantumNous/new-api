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
            <rect x={2} y={2} width={20} height={9} rx={2} fill="#DDE3E8" />
            <rect x={2} y={13} width={20} height={9} rx={2} fill="#DDE3E8" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17 14.5a1 1 0 0 0-1 1v1h-1a1 1 0 1 0 0 2h1v1a1 1 0 1 0 2 0v-1h1a1 1 0 1 0 0-2h-1v-1a1 1 0 0 0-1-1Z"
                fill="#4CC3FA"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17 3.5a1 1 0 0 0-1 1v1h-1a1 1 0 1 0 0 2h1v1a1 1 0 1 0 2 0v-1h1a1 1 0 1 0 0-2h-1v-1a1 1 0 0 0-1-1Z"
                fill="#4CC3FA"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'collapse');
export default IconComponent;
