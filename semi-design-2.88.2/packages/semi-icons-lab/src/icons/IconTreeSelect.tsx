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
            <rect x={2} y={10} width={20} height={12} rx={2} fill="#DDE3E8" />
            <path d="M8 13a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-1Z" fill="#AAB2BF" />
            <path d="M4 13a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1Z" fill="#AAB2BF" />
            <path d="M10 18a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-1Z" fill="#AAB2BF" />
            <path d="M2 4c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z" fill="#3BCE4A" />
            <path d="M14 2h6a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-6V2Z" fill="#818A9B" />
            <path
                d="M18.42 6.08a.5.5 0 0 1-.84 0l-1.06-1.6a.5.5 0 0 1 .41-.78h2.14c.4 0 .63.45.41.78l-1.06 1.6Z"
                fill="white"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'tree-select');
export default IconComponent;
