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
                d="M14.66 5a3.5 3.5 0 1 0-6.33 0H5a2 2 0 0 0-2 2v3.34a3.5 3.5 0 1 1 0 6.33V21c0 1.1.9 2 2 2h13a2 2 0 0 0 2-2v-4.04a3.5 3.5 0 1 0 0-6.93V7a2 2 0 0 0-2-2h-3.34Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'puzzle');
export default IconComponent;
