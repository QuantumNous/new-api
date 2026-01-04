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
                d="M11.5 4.5c-1.79 0-3 1.44-3 2.5 0 1.07.76 2.6 3.72 3.5H6.75A5.54 5.54 0 0 1 5.5 7c0-2.94 2.79-5.5 6-5.5a8.62 8.62 0 0 1 7.2 3.6 1.5 1.5 0 0 1-2.4 1.8 5.63 5.63 0 0 0-4.8-2.4Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M15.72 15.5h3.52c.17.47.26.97.26 1.5 0 1.87-1.03 3.3-2.45 4.2A9.51 9.51 0 0 1 12 22.5c-3.92 0-6.77-2.4-7.46-5.14a1.5 1.5 0 0 1 1.43-1.86h.06a1.5 1.5 0 0 1 1.43 1.14C7.77 17.89 9.3 19.5 12 19.5c1.45 0 2.66-.33 3.44-.83.75-.48 1.06-1.04 1.06-1.67 0-.43-.2-.94-.78-1.5Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M2.5 10.5h19a1.5 1.5 0 0 1 0 3h-19a1.5 1.5 0 0 1 0-3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'strike_through');
export default IconComponent;
