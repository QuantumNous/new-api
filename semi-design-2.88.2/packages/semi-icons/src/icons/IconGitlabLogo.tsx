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
                d="M5.5 1.75c.33 0 .61.2.71.51l2.33 6.99h6.92l2.33-6.99a.75.75 0 0 1 1.42 0l4 11.5c.1.3 0 .66-.27.85l-10.5 7.5a.75.75 0 0 1-.88 0l-10.5-7.5a.75.75 0 0 1-.27-.86l4-11.5c.1-.3.4-.5.71-.5Zm9.45 9h-5.9L12 19.22l2.95-8.47Zm-5.11 6.8-2.37-6.8H4.44l5.4 6.8Zm-5.9-8.3h3.02L5.48 4.83 3.95 9.25Zm-.79 2.29 4.97 6.26-5.73-4.08.76-2.18Zm12.73 6.26 5.73-4.08-.76-2.18-4.97 6.26Zm4.17-8.55h-3l1.47-4.42 1.53 4.42Zm-.5 1.5-5.39 6.8 2.37-6.8h3.03Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'gitlab_logo');
export default IconComponent;
