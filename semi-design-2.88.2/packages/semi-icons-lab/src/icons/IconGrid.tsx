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
            <path fillRule="evenodd" clipRule="evenodd" d="M22 2H2v20h20V2Zm-2 2H4v16h16V4Z" fill="#6A6F7F" />
            <path fillRule="evenodd" clipRule="evenodd" d="M22 9h-2v6h2V9ZM2 15h2V9H2v6Z" fill="#DDE3E8" />
            <path fillRule="evenodd" clipRule="evenodd" d="M15 22v-2H9v2h6ZM9 2v2h6V2H9Z" fill="#DDE3E8" />
            <rect x={7} y={7} width={3} height={3} fill="#6A6F7F" />
            <rect x={7} y={10} width={3} height={4} fill="#DDE3E8" />
            <rect x={14} y={10} width={3} height={4} fill="#DDE3E8" />
            <rect x={10} y={7} width={4} height={3} fill="#DDE3E8" />
            <rect x={10} y={14} width={4} height={3} fill="#DDE3E8" />
            <rect x={14} y={7} width={3} height={3} fill="#6A6F7F" />
            <rect x={7} y={14} width={3} height={3} fill="#6A6F7F" />
            <rect x={14} y={14} width={3} height={3} fill="#6A6F7F" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'grid');
export default IconComponent;
