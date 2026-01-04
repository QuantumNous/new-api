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
                d="M2 3a1 1 0 0 1 2 0v17h17a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1V3Zm18.38 3.47a1 1 0 0 0-1.76-.94L15.1 12.1 10 9.14a1 1 0 0 0-1.37.36l-3.5 6a1 1 0 0 0 1.72 1l3-5.13 5.14 3a1 1 0 0 0 1.38-.4l4-7.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'line_chart_stroked');
export default IconComponent;
