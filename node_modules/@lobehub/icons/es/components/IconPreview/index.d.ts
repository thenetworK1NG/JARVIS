import { ReactNode } from 'react';
import { FlexboxProps } from 'react-layout-kit';
export interface IconPreviewProps extends FlexboxProps {
    children: string | ReactNode;
}
declare const IconPreview: import("react").NamedExoticComponent<IconPreviewProps>;
export default IconPreview;
