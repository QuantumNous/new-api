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
                d="M18.27 4.27a2.64 2.64 0 0 0-3.73 0L6.8 12.02a4.4 4.4 0 1 0 6.23 6.24l5.5-5.5a1.25 1.25 0 1 1 1.77 1.76l-5.5 5.5a6.9 6.9 0 1 1-9.77-9.76l7.75-7.75a5.14 5.14 0 1 1 7.27 7.26l-7.25 7.25a3.37 3.37 0 1 1-4.77-4.76l5.5-5.5a1.25 1.25 0 1 1 1.77 1.76l-5.5 5.5a.87.87 0 1 0 1.23 1.24L18.27 8a2.64 2.64 0 0 0 0-3.74Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'paperclip');
export default IconComponent;
