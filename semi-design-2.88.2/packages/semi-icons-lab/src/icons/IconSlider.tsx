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
            <rect x={5} y={4} width={17} height={2} rx={1} fill="#AAB2BF" />
            <rect x={2} y={11} width={18} height={2} rx={1} fill="#4CC3FA" />
            <rect x={5} y={18} width={17} height={2} rx={1} fill="#AAB2BF" />
            <circle cx={5.5} cy={5} r={3.5} fill="#DDE3E8" />
            <circle cx={18.5} cy={12} r={3.5} fill="#DDE3E8" />
            <circle cx={5.5} cy={19} r={3.5} fill="#DDE3E8" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'slider');
export default IconComponent;
