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
                d="M19 19.5c0 .83-.67 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 3 19.5v-13a1.5 1.5 0 1 1 3 0v9.38L19.44 2.44a1.5 1.5 0 0 1 2.12 2.12L8.12 18h9.38c.83 0 1.5.67 1.5 1.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'arrow_down_left');
export default IconComponent;
