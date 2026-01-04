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
                d="M12 4.5a7.5 7.5 0 0 0-7.08 5.03 1.5 1.5 0 0 1-2.84-.99 10.5 10.5 0 0 1 18.55-2.52l.43-1.45a1.5 1.5 0 1 1 2.88.86l-1.5 5a1.5 1.5 0 0 1-1.73 1.04l-5-1a1.5 1.5 0 1 1 .58-2.94l2.01.4A7.5 7.5 0 0 0 12 4.5ZM5.7 16.07l2 .4a1.5 1.5 0 1 0 .6-2.94l-5-1a1.5 1.5 0 0 0-1.74 1.04l-1.5 5a1.5 1.5 0 0 0 2.88.86l.43-1.45A10.49 10.49 0 0 0 21.9 15.5a1.5 1.5 0 1 0-2.83-1A7.5 7.5 0 0 1 5.7 16.07Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'sync');
export default IconComponent;
