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
                d="M1 4.5C1 3.67 1.67 3 2.5 3h11a1.5 1.5 0 0 1 0 3h-11A1.5 1.5 0 0 1 1 4.5Zm0 5C1 8.67 1.67 8 2.5 8h11a1.5 1.5 0 0 1 0 3h-11A1.5 1.5 0 0 1 1 9.5ZM2.5 13a1.5 1.5 0 0 0 0 3h11a1.5 1.5 0 0 0 0-3h-11ZM1 19.5c0-.83.67-1.5 1.5-1.5h11a1.5 1.5 0 0 1 0 3h-11A1.5 1.5 0 0 1 1 19.5Zm15.94-9.88a1.5 1.5 0 1 1 2.12-2.12l3.5 3.5a1.5 1.5 0 0 1 0 2.12l-3.5 3.5a1.5 1.5 0 1 1-2.12-2.12l2.44-2.44-2.44-2.44Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'indent_right');
export default IconComponent;
