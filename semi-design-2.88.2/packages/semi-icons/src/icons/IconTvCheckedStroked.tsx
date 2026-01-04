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
                d="M19.5 4.87a1 1 0 1 0-1-1.74L11.76 7 5.52 3.15a1 1 0 0 0-1.04 1.7L7.97 7H3.95C2.89 7 2 7.84 2 8.93v11.14C2 21.16 2.9 22 3.95 22h16.1c1.06 0 1.95-.84 1.95-1.93V8.93C22 7.84 21.1 7 20.05 7h-4.28l3.73-2.13ZM11.52 9a1 1 0 0 1-.04 0H4v11h16V9h-7.98a1 1 0 0 1-.04 0h-.46Zm4.73 3.66a1 1 0 0 0-1.5-1.32l-3.3 3.7-2.24-2.25a1 1 0 0 0-1.42 1.42l3 3a1 1 0 0 0 1.46-.05l4-4.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'tv_checked_stroked');
export default IconComponent;
