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
                d="M4.08 8.15c.47-.5 1.26-.54 1.77-.07L12 13.8l6.15-5.7a1.25 1.25 0 0 1 1.7 1.83l-7 6.5c-.48.44-1.22.44-1.7 0l-7-6.5a1.25 1.25 0 0 1-.07-1.77Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'chevron_down_stroked');
export default IconComponent;
