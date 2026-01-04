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
                d="M9 4.5c0-.83.67-1.5 1.5-1.5h11a1.5 1.5 0 0 1 0 3h-11A1.5 1.5 0 0 1 9 4.5Zm0 5c0-.83.67-1.5 1.5-1.5h11a1.5 1.5 0 0 1 0 3h-11A1.5 1.5 0 0 1 9 9.5Zm1.5 3.5a1.5 1.5 0 0 0 0 3h11a1.5 1.5 0 0 0 0-3h-11ZM9 19.5c0-.83.67-1.5 1.5-1.5h11a1.5 1.5 0 0 1 0 3h-11A1.5 1.5 0 0 1 9 19.5ZM7.06 9.56a1.5 1.5 0 1 0-2.12-2.12l-3.5 3.5a1.5 1.5 0 0 0 0 2.12l3.5 3.5a1.5 1.5 0 0 0 2.12-2.12L4.62 12l2.44-2.44Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'indent_left');
export default IconComponent;
