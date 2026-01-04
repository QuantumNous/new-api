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
                d="M17.66 19.78a1.5 1.5 0 0 0 2.12-2.12L14.12 12l5.66-5.66a1.5 1.5 0 0 0-2.12-2.12L12 9.88 6.34 4.22a1.5 1.5 0 1 0-2.12 2.12L9.88 12l-5.66 5.66a1.5 1.5 0 0 0 2.12 2.12L12 14.12l5.66 5.66Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'close');
export default IconComponent;
