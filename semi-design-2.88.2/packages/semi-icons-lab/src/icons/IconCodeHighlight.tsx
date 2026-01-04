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
            <rect y={0.406} width={22} height={10} rx={2} fill="#49C4FD" />
            <path d="M0 4.6h11v13H2a2 2 0 0 1-2-2v-11Z" fill="#F9FCFF" />
            <path d="M11 4.6h11v11a2 2 0 0 1-2 2h-9v-13Z" fill="#F9FCFF" />
            <path d="m7 8-3 3 3 3" stroke="#F8CE27" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <path d="m15 8 3 3-3 3" stroke="#49C4FD" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <path d="m12 8-2 6.5" stroke="#E0E4E7" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'code-highlight');
export default IconComponent;
