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
                d="M19.64 16.44a1.5 1.5 0 0 1-2.12 0l-5.66-5.66-5.66 5.66a1.5 1.5 0 1 1-2.12-2.12L10.8 7.6a1.5 1.5 0 0 1 2.12 0l6.72 6.72a1.5 1.5 0 0 1 0 2.12Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'chevron_up');
export default IconComponent;
