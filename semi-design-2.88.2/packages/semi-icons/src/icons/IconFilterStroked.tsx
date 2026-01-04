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
                d="M12.57 12.06 19.77 4H4.25l7.25 8.06v6.39l1.07.7v-7.09Zm2 8.94-.01.13a1 1 0 0 1-1.32.81l-.12-.05-3.07-2A1 1 0 0 1 9.5 19v-6.17L1.24 3.65A1 1 0 0 1 2 2h20a1 1 0 0 1 .76 1.65l-8.2 9.18V21Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'filter_stroked');
export default IconComponent;
