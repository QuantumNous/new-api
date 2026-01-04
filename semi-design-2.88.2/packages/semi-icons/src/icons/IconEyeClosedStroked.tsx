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
                d="M2.7 5.04c.54-.15 1.09.16 1.3.67.53 1.36 1.42 2.8 2.6 3.98a7.6 7.6 0 0 0 5.58 2.35 8.73 8.73 0 0 0 8.29-6.25c.17-.53.7-.87 1.23-.75.54.12.89.65.73 1.18a11.31 11.31 0 0 1-3.18 5.08l2.66 3.53a1 1 0 0 1-1.6 1.2l-2.66-3.53c-.77.46-1.6.83-2.5 1.09l1.49 4.09a1 1 0 1 1-1.88.68l-1.6-4.38a12.03 12.03 0 0 1-1.97.03l-1.58 4.35a1 1 0 1 1-1.88-.68l1.48-4.08a9.64 9.64 0 0 1-2.39-1.17l-2.71 3.6a1 1 0 0 1-1.6-1.2l2.76-3.66-.06-.06a13.75 13.75 0 0 1-3.15-4.85.94.94 0 0 1 .65-1.22Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'eye_closed_stroked');
export default IconComponent;
