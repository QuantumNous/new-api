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
                d="M4 12a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm8-10c-2.4 0-4.6.85-6.33 2.26L4.31 2.89a1 1 0 0 0-1.42 1.42l1.37 1.36a9.96 9.96 0 0 0 0 12.66l-1.37 1.36a1 1 0 1 0 1.42 1.42l1.36-1.37a9.96 9.96 0 0 0 12.66 0l1.36 1.37a1 1 0 0 0 1.42-1.42l-1.37-1.36a9.96 9.96 0 0 0 0-12.66l1.37-1.36a1 1 0 0 0-1.42-1.42l-1.36 1.37A9.96 9.96 0 0 0 12 2Zm-2 10a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm2-4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'fixed_stroked');
export default IconComponent;
