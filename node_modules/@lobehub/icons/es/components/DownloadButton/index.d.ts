/// <reference types="react" />
import { ActionIconSize, DivProps, TooltipProps } from '@lobehub/ui';
export interface DownloadButtonProps extends DivProps {
    className?: string;
    onClick?: () => void;
    placement?: TooltipProps['placement'];
    size?: ActionIconSize;
}
declare const DownloadButton: import("react").NamedExoticComponent<DownloadButtonProps>;
export default DownloadButton;
