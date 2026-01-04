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
                d="M15.8 4.3a1 1 0 0 1 1.4 0L19 6.08l1.8-1.8a1 1 0 1 1 1.4 1.42L20.42 7.5l1.8 1.8a1 1 0 0 1-1.42 1.4L19 8.92l-1.8 1.8a1 1 0 0 1-1.4-1.42l1.79-1.79-1.8-1.8a1 1 0 0 1 0-1.4Zm6.95 11.36a1 1 0 0 0-1.5-1.32l-2.8 3.2-1.24-1.25a1 1 0 0 0-1.42 1.42l2 2a1 1 0 0 0 1.46-.05l3.5-4ZM1 5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5Zm2 1v3h9V6H3Zm-1 7a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H2Zm1 5v-3h9v3H3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'true_false_stroked');
export default IconComponent;
