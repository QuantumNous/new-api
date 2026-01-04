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
            <path d="M2 5c0-1.1.9-2 2-2h7v5H2V5Z" fill="#3BCE4A" />
            <path d="M13 3h7a2 2 0 0 1 2 2v3h-9V3Z" fill="#3BCE4A" />
            <rect x={2} y={10} width={9} height={5} fill="#AAB2BF" />
            <rect x={13} y={10} width={9} height={5} fill="#DDE3E8" />
            <path d="M2 17h9v5H4a2 2 0 0 1-2-2v-3Z" fill="#DDE3E8" />
            <path d="M13 17h9v3a2 2 0 0 1-2 2h-7v-5Z" fill="#AAB2BF" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'table');
export default IconComponent;
