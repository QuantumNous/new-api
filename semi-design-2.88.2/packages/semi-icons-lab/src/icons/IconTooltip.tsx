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
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3.3 3.87A2.3 2.3 0 0 0 1.23 6.4l1.2 11.46a2.3 2.3 0 0 0 2.54 2.05l4.1-.43 3.46 2.8c.25.2.61.16.81-.08l2.8-3.47 4.3-.45a2.3 2.3 0 0 0 2.05-2.53L21.3 4.29a2.3 2.3 0 0 0-2.54-2.05L3.29 3.87Z"
                fill="#6A6F7F"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M11.46 8.57c-.55.06-.95.57-.9 1.14.07.56-.33 1.07-.89 1.13a1.02 1.02 0 0 1-1.1-.92 3.07 3.07 0 0 1 2.67-3.41 3.07 3.07 0 0 1 3.34 2.77c.09.88-.27 1.59-.59 2.06a6.1 6.1 0 0 1-.47.6l-.16.17-.12.14-.6.75a.99.99 0 0 1-1.41.15 1.06 1.06 0 0 1-.16-1.45l.6-.76c.07-.1.18-.22.27-.32a14.08 14.08 0 0 0 .4-.48c.2-.29.25-.49.23-.65a1.02 1.02 0 0 0-1.1-.92Z"
                fill="white"
            />
            <circle cx={12.0566} cy={15.1576} r={1.2} transform="rotate(-6 12.0566 15.1576)" fill="white" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'tooltip');
export default IconComponent;
