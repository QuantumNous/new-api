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
                d="M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm9-11a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-4.23-2.36a1 1 0 1 0-1.54-1.28l-4.3 5.16-2.22-2.23a1 1 0 0 0-1.42 1.42l3 3a1 1 0 0 0 1.48-.07l5-6Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'check_circle_stroked');
export default IconComponent;
