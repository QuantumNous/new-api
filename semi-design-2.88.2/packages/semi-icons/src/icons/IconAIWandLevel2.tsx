import * as React from 'react';
import { getFillColor } from '../utils';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    const { fill, ...rest } = props;
    const [primaryColor, secondColor] = getFillColor(fill, 2);
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...rest}
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.11 15.05a4.56 4.56 0 0 1-2.64 2.3.68.68 0 0 0 0 1.3 4.57 4.57 0 0 1 2.64 2.3 4.4 4.4 0 0 1 .24.58.68.68 0 0 0 1.3 0 4.57 4.57 0 0 1 .24-.58 4.56 4.56 0 0 1 2.06-2.06 4.4 4.4 0 0 1 .58-.24.68.68 0 0 0 0-1.3 4.57 4.57 0 0 1-.58-.24 4.56 4.56 0 0 1-2.3-2.64.68.68 0 0 0-1.3 0 4.57 4.57 0 0 1-.24.58Zm.89 1.68c-.36.48-.79.91-1.27 1.27.48.36.91.79 1.27 1.27.36-.48.79-.91 1.27-1.27A6.2 6.2 0 0 1 18 16.73Z"
                fill={primaryColor}
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M4.83 3.53a3.42 3.42 0 0 0 .68-1.18.51.51 0 0 1 .98 0 3.42 3.42 0 0 0 2.16 2.16c.47.16.47.82 0 .98a3.42 3.42 0 0 0-2.16 2.16.51.51 0 0 1-.98 0 3.42 3.42 0 0 0-2.16-2.16.51.51 0 0 1 0-.98 3.42 3.42 0 0 0 1.48-.98Z"
                fill={primaryColor}
            />
            <path
                d="M16.57 2.93a3.18 3.18 0 1 1 4.5 4.5L7.43 21.07a3.18 3.18 0 1 1-4.5-4.5L16.57 2.93ZM4.34 17.97a1.2 1.2 0 0 0 1.7 1.7L16.6 9.08l-1.7-1.7L4.34 17.97ZM19.67 4.33a1.2 1.2 0 0 0-1.7 0L16.3 6l1.7 1.7 1.66-1.66a1.2 1.2 0 0 0 0-1.7Z"
                fill={secondColor}
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'ai_wand_level_2');
export default IconComponent;
