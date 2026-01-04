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
                d="M1.41 10.59 3.5 8.5v-3c0-1.1.9-2 2-2h3l2.09-2.09a2 2 0 0 1 2.82 0L15.5 3.5h3a2 2 0 0 1 2 2v3l2.09 2.09a2 2 0 0 1 0 2.82L20.5 15.5v3a2 2 0 0 1-2 2h-3l-2.09 2.09a2 2 0 0 1-2.82 0L8.5 20.5h-3a2 2 0 0 1-2-2v-3l-2.09-2.09a2 2 0 0 1 0-2.82ZM7 13l3.24 3.24a1 1 0 0 0 1.46-.04l5.44-6.22a1.4 1.4 0 1 0-2.12-1.8L11 13l-2-2a1.41 1.41 0 1 0-2 2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'verify');
export default IconComponent;
