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
                d="M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm5.04-6.14a1.5 1.5 0 0 1-2.13.04l-2.87-2.78L9.26 17A1.5 1.5 0 0 1 7.1 14.9l2.78-2.87L7 9.26A1.5 1.5 0 1 1 9.1 7.1l2.87 2.78L14.74 7A1.5 1.5 0 0 1 16.9 9.1l-2.78 2.87L17 14.74c.6.58.61 1.53.04 2.12Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'clear');
export default IconComponent;
