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
                d="M5.9 1.59a2.11 2.11 0 0 1 2.89.77l2.78 4.81c.58 1.01.23 2.3-.77 2.89l-1.55.89h-.01v.01a36.9 36.9 0 0 0 3.92 3.82h.01l.01-.01 1.08-1.87a2.11 2.11 0 0 1 2.88-.77l4.81 2.78c1.01.58 1.36 1.87.77 2.88l-2.22 3.85a2.11 2.11 0 0 1-2.21 1.02h-.03l-.02-.01a23.67 23.67 0 0 1-11.26-6.3 23.68 23.68 0 0 1-5.8-9.43V6.9a4.8 4.8 0 0 1-.15-.73 2.8 2.8 0 0 1 0-.88l.01-.05A2.1 2.1 0 0 1 2.06 3.8L5.9 1.59Zm1 1.73L3.07 5.54a.11.11 0 0 0-.06.08v.1L3 5.9c.02.16.05.31.08.4a21.68 21.68 0 0 0 5.3 8.63 21.67 21.67 0 0 0 10.27 5.76c.05 0 .09-.01.11-.05l2.22-3.85a.11.11 0 0 0-.04-.15l-4.81-2.78a.11.11 0 0 0-.15.04l-1.08 1.87a2 2 0 0 1-3.03.55 38.68 38.68 0 0 1-4.14-4.03 2 2 0 0 1 .51-3.08l1.55-.89c.05-.03.07-.1.04-.15L7.06 3.36a.11.11 0 0 0-.15-.04Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'phone_stroked');
export default IconComponent;
