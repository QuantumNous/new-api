import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 22 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <path
                d="M18 5a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v12.59a1 1 0 0 0 1.7.7l1.71-1.7A2 2 0 0 1 4.83 16H16a2 2 0 0 0 2-2V5Z"
                fill="#DFDFE7"
            />
            <path
                d="M4 2c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v12.59a1 1 0 0 1-1.7.7l-1.71-1.7a2 2 0 0 0-1.42-.59H6a2 2 0 0 1-2-2V2Z"
                fill="#49C4FD"
            />
            <rect x={14} y={2.5} width={4} height={1.5} fill="#F4CE2D" />
            <rect x={8} y={8.5} width={10} height={1.5} fill="#F9FCFF" />
            <rect x={8} y={5.5} width={10} height={1.5} fill="#F9FCFF" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'chat');
export default IconComponent;
