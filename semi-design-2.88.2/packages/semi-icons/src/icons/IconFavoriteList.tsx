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
                d="M13.25 1.9c-.4-1.2-2.1-1.2-2.5 0L8.76 8.02H2.31a1.3 1.3 0 0 0-.77 2.37l5.22 3.78-2 6.11c-.39 1.2 1 2.21 2.03 1.46L12 17.96V13a1 1 0 0 1 1-1h7.23l2.23-1.61a1.3 1.3 0 0 0-.77-2.37h-6.45l-2-6.12Z"
                fill="currentColor"
            />
            <path
                d="M14 14.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-2Zm0 5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'favorite_list');
export default IconComponent;
