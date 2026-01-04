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
                d="M3.5 18A1.5 1.5 0 0 1 2 16.5v-13C2 2.67 2.67 2 3.5 2h13a1.5 1.5 0 0 1 0 3H7.12l13.44 13.44a1.5 1.5 0 0 1-2.12 2.12L5 7.12v9.38c0 .83-.67 1.5-1.5 1.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'arrow_up_left');
export default IconComponent;
