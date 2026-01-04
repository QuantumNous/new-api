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
                d="M9.65 2.11a1.11 1.11 0 1 0-2.22 0v.87H3.1A2.1 2.1 0 0 0 1 5.08V20.9c0 1.16.94 2.1 2.1 2.1h17.8a2.1 2.1 0 0 0 2.1-2.1V5.08a2.1 2.1 0 0 0-2.1-2.1h-4.33V2.1a1.11 1.11 0 1 0-2.22 0v.87h-4.7V2.1Zm6.92 18.67h4.2v-3.71h-4.2v3.7Zm0-5.94h4.2v-3.7h-4.2v3.7Zm-2.22-3.7v3.7h-4.7v-3.7h4.7Zm1.11-2.23h5.32v-3.7h-4.2v.86a1.11 1.11 0 1 1-2.23 0V5.2h-4.7v.87a1.11 1.11 0 0 1-2.22 0V5.2h-4.2v3.71h12.23Zm-1.11 8.16v3.7h-4.7v-3.7h4.7Zm-6.92 3.7v-3.7h-4.2v3.7h4.2Zm0-5.93v-3.7h-4.2v3.7h4.2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'calendar_stroked');
export default IconComponent;
