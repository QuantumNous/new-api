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
            <circle cx={12} cy={12} r={10.25} fill="white" stroke="#AAB2BF" strokeWidth={1.5} />
            <path
                d="M14.5 6.5 12 12l5 5.5"
                stroke="#6A6F7F"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx={12} cy={12} r={2} fill="#324350" />
            <path d="M13 11.63 12 12l-7 3" stroke="#FBCD2C" strokeLinecap="round" />
            <circle cx={12} cy={12} r={1} fill="#FBCD2C" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'time-picker');
export default IconComponent;
