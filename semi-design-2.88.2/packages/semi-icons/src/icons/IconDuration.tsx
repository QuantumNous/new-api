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
                d="M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm7.86-11a7.86 7.86 0 0 1-13.47 5.5L12 12V4.14A7.86 7.86 0 0 1 19.86 12Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'duration');
export default IconComponent;
