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
                d="M1 3c0-1.1.9-2 2-2h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7.5v4c0 .83.67 1.5 1.5 1.5h4V15c0-1.1.9-2 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-1.5H9A4.5 4.5 0 0 1 4.5 15v-4H3a2 2 0 0 1-2-2V3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'connection_point_1');
export default IconComponent;
