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
            <rect x={1} y={4} width={22} height={16} rx={3} fill="#DDE3E8" />
            <circle cx={6} cy={12} r={2} fill="#6A6F7F" />
            <circle cx={12} cy={12} r={2} fill="#6A6F7F" />
            <circle cx={18} cy={12} r={2} fill="#6A6F7F" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'overflow');
export default IconComponent;
