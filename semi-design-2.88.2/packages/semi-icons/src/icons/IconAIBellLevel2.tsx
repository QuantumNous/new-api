import * as React from 'react';
import { convertIcon } from '../components/Icon';
import { getFillColor } from '../utils';
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
                d="M17.11 4.05a4.56 4.56 0 0 1-2.06 2.06 4.28 4.28 0 0 1-.58.24.68.68 0 0 0 0 1.3 4.56 4.56 0 0 1 .58.24c.9.44 1.62 1.17 2.06 2.06a4.4 4.4 0 0 1 .24.58.68.68 0 0 0 1.3 0 4.57 4.57 0 0 1 .24-.58 4.56 4.56 0 0 1 2.06-2.06 4.28 4.28 0 0 1 .58-.24.68.68 0 0 0 0-1.3 4.56 4.56 0 0 1-.58-.24 4.56 4.56 0 0 1-2.3-2.64.68.68 0 0 0-1.3 0 4.58 4.58 0 0 1-.24.58ZM18 5.73c-.36.48-.79.91-1.27 1.27.48.36.91.79 1.27 1.27.36-.48.79-.91 1.27-1.27A6.2 6.2 0 0 1 18 5.73Z"
                fill={primaryColor}
            />
            <path
                d="M20 20a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2h16ZM12 3.5a1 1 0 0 1 0 2 5 5 0 0 0-5 5v6h10V14a1 1 0 0 1 2 0v3.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a7 7 0 0 1 7-7ZM1.05 6.18a1 1 0 0 1 1.17-.66l.1.03 1.5.5.1.04a1 1 0 0 1-.64 1.89l-.1-.03-1.5-.5-.1-.04a1 1 0 0 1-.53-1.23ZM2.8 2.8a1 1 0 0 1 1.34-.07l.08.07 1.5 1.5.07.08a1 1 0 0 1-1.41 1.4l-.08-.06-1.5-1.5-.07-.08A1 1 0 0 1 2.8 2.8Zm3.4-1.74a1 1 0 0 1 1.22.54l.04.1.5 1.5.03.1a1 1 0 0 1-1.9.62l-.03-.1-.5-1.5-.03-.1a1 1 0 0 1 .66-1.16Z"
                fill={secondColor}
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'ai_bell_level_2');
export default IconComponent;
