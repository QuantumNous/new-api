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
                d="M1 5c0-1.1.9-2 2-2h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8v2h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2H3a2 2 0 0 1-2-2V5Zm20 10H3V5h18v10Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'monitor_stroked');
export default IconComponent;
