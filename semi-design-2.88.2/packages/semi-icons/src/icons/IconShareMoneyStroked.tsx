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
                d="M17 2a3.5 3.5 0 0 0-3.43 4.18L8.3 9.37a3.5 3.5 0 1 0 .07 5.2L13 17.3v-2.33l-3.6-2.12a3.5 3.5 0 0 0-.03-1.79l5.13-3.1a3.49 3.49 0 0 0 6-2.46A3.5 3.5 0 0 0 17 2Zm-1.5 3.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM4.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm11.53 1.02L18 14.99l1.97-1.97a.75.75 0 1 1 1.06 1.06l-1.93 1.93H21a.75.75 0 0 1 0 1.5h-2.25v1H21a.75.75 0 0 1 0 1.5h-2.25v1.24a.75.75 0 0 1-1.5 0v-1.24H15a.75.75 0 1 1 0-1.5h2.25v-1H15a.75.75 0 0 1 0-1.5h1.9l-1.93-1.93a.75.75 0 1 1 1.06-1.06Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'share_money_stroked');
export default IconComponent;
