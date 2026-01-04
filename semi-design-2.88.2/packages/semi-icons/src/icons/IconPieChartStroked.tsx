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
                d="M17.62 19.03A9 9 0 1 1 11 3.05v9.36l6.62 6.62Zm1.41-1.41L13 11.59V3.05a9 9 0 0 1 6.03 14.57ZM23 12a11 11 0 1 1-22 0 11 11 0 0 1 22 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'pie_chart_stroked');
export default IconComponent;
