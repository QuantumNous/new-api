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
                d="M7.44 19.8a1.5 1.5 0 0 1 0-2.13l5.66-5.65-5.66-5.66a1.5 1.5 0 1 1 2.12-2.12l6.72 6.72a1.5 1.5 0 0 1 0 2.12L9.56 19.8a1.5 1.5 0 0 1-2.12 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'chevron_right');
export default IconComponent;
