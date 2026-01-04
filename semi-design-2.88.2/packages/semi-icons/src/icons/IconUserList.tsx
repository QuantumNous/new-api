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
                d="M11.35 15c.54 0 1.08.04 1.6.13.23.03.4.24.4.48v5.89a.5.5 0 0 1-.5.5H2.49a.48.48 0 0 1-.46-.64A10 10 0 0 1 11.35 15Zm4.5 5c.27 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1c0-.28.22-.5.5-.5h1Zm5.65 0c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-3.65a.5.5 0 0 1-.5-.5v-1c0-.28.22-.5.5-.5h3.65Zm-5.65-3c.27 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1c0-.28.22-.5.5-.5h1Zm5.65 0c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-3.65a.5.5 0 0 1-.5-.5v-1c0-.28.22-.5.5-.5h3.65ZM12.35 2c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6 2.7-6 6-6Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'user_list');
export default IconComponent;
