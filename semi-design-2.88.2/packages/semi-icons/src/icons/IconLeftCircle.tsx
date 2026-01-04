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
                d="M12 1a11 11 0 1 1 0 22 11 11 0 0 1 0-22Zm2.1 6.3a1 1 0 0 0-1.42 0L8.8 11.17a1 1 0 0 0 0 1.42l3.9 3.89a1 1 0 0 0 1.4-1.42l-3.18-3.18L14.1 8.7a1 1 0 0 0 0-1.42Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'left-circle');
export default IconComponent;
