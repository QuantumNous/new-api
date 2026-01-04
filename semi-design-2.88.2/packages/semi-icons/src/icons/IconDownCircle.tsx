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
                d="M1 12a11 11 0 1 1 22 0 11 11 0 0 1-22 0Zm6.3-2.1a1 1 0 0 0 0 1.42l3.88 3.89a1 1 0 0 0 1.42 0l3.89-3.9a1 1 0 0 0-1.42-1.4l-3.18 3.18L8.7 9.9a1 1 0 0 0-1.42 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'down_circle');
export default IconComponent;
