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
                d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V3Zm2 1v16h2V4h-2ZM2 8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8Zm2 1v11h2V9H4Zm13 1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1h-4Zm1 10v-8h2v8h-2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'bar_chart_v_stroked');
export default IconComponent;
