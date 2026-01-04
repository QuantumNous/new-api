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
                d="M17.08 16.32H6.95a.5.5 0 0 1-.41-.78l5.06-7.6c.2-.3.64-.3.83 0l5.07 7.6a.5.5 0 0 1-.42.78Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'small_triangle_top');
export default IconComponent;
