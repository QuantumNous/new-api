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
                d="M12 4.5a7.5 7.5 0 1 1-7.07 10 1.5 1.5 0 0 0-2.83 1 10.5 10.5 0 1 0 1.27-9.48l-.43-1.45a1.5 1.5 0 1 0-2.88.86l1.5 5c.23.74.98 1.2 1.73 1.04l5-1a1.5 1.5 0 0 0-.58-2.94l-2.01.4A7.5 7.5 0 0 1 12 4.5Zm1.5 3a1.5 1.5 0 0 0-3 0V12c0 .4.16.78.44 1.06l3 3a1.5 1.5 0 0 0 2.12-2.12l-2.56-2.56V7.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'history');
export default IconComponent;
