import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 22 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <path d="M0 14h22v2a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2Z" fill="#6A6F7F" />
            <path d="M0 2C0 .9.9 0 2 0h18a2 2 0 0 1 2 2v12H0V2Z" fill="#DDE3E8" />
            <rect opacity={0.5} x={18} y={15} width={2} height={2} rx={1} fill="#DDE3E8" />
            <rect x={3} y={5} width={5} height={1.5} fill="#6A6F7F" />
            <rect x={3} y={9} width={7} height={1.5} fill="#6A6F7F" />
            <rect x={12} y={4} width={7} height={7} rx={1} fill="#F8CE27" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'markdown');
export default IconComponent;
