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
            <g clipPath="url(#clip0_1_3058)">
                <path
                    d="M.82 4.55c-.4.45-.47 1.38-.4 2L.76 9.8c.1 1.03.98 1.78 1.95 1.68l.23-.02.9 8.57c.2 1.87 1.3 2.76 3.29 2.55l10.94-1.15c2.98-.31 3.87-1.41 3.68-3.28l-.9-8.58c.97-.1 1.9-1.04 1.79-2.07l-.34-3.23c-.09-.8-.41-1.46-1.08-1.86-1.35-.79-4.97-1.9-10.32-1.34C5.34 1.64 1.73 3.52.82 4.55Z"
                    fill="#FBCD2C"
                />
                <circle cx={7.21108} cy={8.98682} r={1.5} transform="rotate(-6 7.21108 8.98682)" fill="#324350" />
                <circle cx={16.1618} cy={8.04605} r={1.5} transform="rotate(-6 16.1618 8.04605)" fill="#324350" />
                <path
                    d="M12.47 15.98a4 4 0 0 0 3.56-4.4s-1.05-.4-4.03-.08c-2.98.31-3.93.92-3.93.92a4 4 0 0 0 4.4 3.56Z"
                    fill="#324350"
                />
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M14.67 15.02a3.98 3.98 0 0 1-4.55.48 2.4 2.4 0 0 1 4.55-.48Z"
                    fill="#FF2969"
                />
            </g>
            <defs>
                <clipPath id="clip0_1_3058">
                    <rect width={24} height={24} fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'toast');
export default IconComponent;
