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
                d="M4 1a1 1 0 0 0-1 1v5a1 1 0 0 0 .4.8L7 10.5v.6a7 7 0 1 0 10 0v-.6l3.6-2.7A1 1 0 0 0 21 7V2a1 1 0 0 0-1-1H4Zm3 2v5L5 6.5V3h2Zm0 13a4.98 4.98 0 0 1 8.33-3.73A4.99 4.99 0 0 1 12 21a5 5 0 0 1-5-5Zm12-9.5L17 8V3h2v3.5ZM9 9.67a6.97 6.97 0 0 1 6 0V3H9v6.67ZM13 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'prize_stroked');
export default IconComponent;
