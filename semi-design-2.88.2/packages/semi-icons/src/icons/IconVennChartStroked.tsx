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
                d="M12 3a5 5 0 0 0-5 5.07 7.06 7.06 0 0 1 5 1.18 6.97 6.97 0 0 1 5-1.18V8a5 5 0 0 0-5-5Zm6.97 5.66L19 8a7 7 0 1 0-13.97.66A7 7 0 1 0 12 20.75a7 7 0 1 0 6.97-12.09Zm-2.4 1.37a5.06 5.06 0 0 0-3.07.64c.4.5.73 1.07.98 1.67a5.02 5.02 0 0 0 2.09-2.3Zm-6.07.64a4.98 4.98 0 0 0-3.07-.64 5.02 5.02 0 0 0 2.1 2.31 7 7 0 0 1 .97-1.67Zm.93 2.3A5 5 0 0 1 12 12a5 5 0 0 1 .57.97 5.06 5.06 0 0 1-1.14 0Zm-2.4 1.37a7.03 7.03 0 0 1-3.5-3.68 5 5 0 1 0 4.97 8.67 6.97 6.97 0 0 1-1.47-4.99ZM12 18a4.98 4.98 0 0 1-1-3.07 7.05 7.05 0 0 0 2 0V15c0 1.13-.37 2.16-1 3Zm1.5 1.33a6.97 6.97 0 0 0 1.47-4.99 7.02 7.02 0 0 0 3.5-3.68 5 5 0 1 1-4.97 8.67Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'venn_chart_stroked');
export default IconComponent;
