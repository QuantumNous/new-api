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
                d="M7.9 20.17a1.25 1.25 0 0 1-.07-1.77l5.71-6.15-5.7-6.15a1.25 1.25 0 0 1 1.83-1.7l6.5 7c.44.48.44 1.22 0 1.7l-6.5 7c-.47.5-1.26.54-1.77.07Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'chevron_right_stroked');
export default IconComponent;
