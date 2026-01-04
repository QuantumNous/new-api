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
                d="M16.5 2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h13Zm-1 2h-11v2h11V4Zm-2 12a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h10Zm-1 2h-8v2h8v-2Zm10-8a1 1 0 0 0-1-1h-18a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-4Zm-18 1h16v2h-16v-2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'bar_chart_h_stroked');
export default IconComponent;
