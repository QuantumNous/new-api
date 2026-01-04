import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 22 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <rect width={22} height={16} rx={2} fill="#4CC3FA" />
            <rect x={3} y={4} width={16} height={8} rx={1} fill="white" />
            <circle cx={6.5} cy={8} r={1} fill="#4CC3FA" />
            <circle cx={9.5} cy={8} r={1} fill="#4CC3FA" />
            <circle cx={12.5} cy={8} r={1} fill="#4CC3FA" />
            <circle cx={15.5} cy={8} r={1} fill="#4CC3FA" />
            <path
                d="M3 7V4.5c0-.28.22-.5.5-.5H6"
                stroke="#F8CE27"
                strokeWidth={1.5}
                strokeLinecap="square"
                strokeLinejoin="round"
            />
            <path
                d="M19 9v2.5a.5.5 0 0 1-.5.5H16"
                stroke="#F8CE27"
                strokeWidth={1.5}
                strokeLinecap="square"
                strokeLinejoin="round"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'pincode');
export default IconComponent;
