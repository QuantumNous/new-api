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
                d="M9.93 4.93c.25.8-.2 1.63-.99 1.88a7.02 7.02 0 0 0-4.08 3.32A5.02 5.02 0 0 1 11 15a5 5 0 0 1-10 0v-1.5a10 10 0 0 1 7.06-9.56c.8-.24 1.63.2 1.87 1Zm12 0c.25.8-.2 1.63-.99 1.88a7.02 7.02 0 0 0-4.08 3.32A5.02 5.02 0 0 1 23 15a5 5 0 0 1-10 0v-1.5a10 10 0 0 1 7.06-9.56c.8-.24 1.63.2 1.87 1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'quote');
export default IconComponent;
