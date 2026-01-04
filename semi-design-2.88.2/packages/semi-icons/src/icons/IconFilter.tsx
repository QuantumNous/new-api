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
                d="M1.1 2.58A1 1 0 0 1 2 2h20a1 1 0 0 1 .76 1.65l-8.2 9.18V21a1 1 0 0 1-1.44.9l-3.07-2a1 1 0 0 1-.55-.9v-6.17L1.24 3.65a1 1 0 0 1-.15-1.07Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'filter');
export default IconComponent;
