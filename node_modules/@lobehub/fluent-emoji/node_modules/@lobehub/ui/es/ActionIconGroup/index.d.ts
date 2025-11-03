/// <reference types="react" />
import { type LucideIcon } from 'lucide-react';
import { type ActionIconProps } from "../ActionIcon";
import { IconSizeType } from "../Icon";
import { DivProps } from "../types";
export interface ActionIconGroupItems {
    disable?: boolean;
    icon: LucideIcon;
    key: string;
    label: string;
}
export interface ActionEvent {
    item: ActionIconGroupItems;
    key: string;
    keyPath: string[];
}
export interface ActionIconGroupProps extends DivProps {
    /**
     * @description The direction of the icons
     * @default "row"
     */
    direction?: 'row' | 'column';
    /**
     * @description The menu items for the dropdown
     */
    dropdownMenu?: (ActionIconGroupItems | {
        type: 'divider';
    })[];
    /**
     * @description The items to be rendered
     * @default []
     */
    items?: ActionIconGroupItems[];
    onActionClick?: (action: ActionEvent) => void;
    /**
     * @description The position of the tooltip relative to the target
     * @enum ["top","left","right","bottom","topLeft","topRight","bottomLeft","bottomRight","leftTop","leftBottom","rightTop","rightBottom"]
     */
    placement?: ActionIconProps['placement'];
    /**
     * @description The size of the group
     * @default "small"
     */
    size?: IconSizeType;
    /**
     * @description Whether to add a spotlight background
     * @default true
     */
    spotlight?: boolean;
    /**
     * @description The type of the group
     * @default "block"
     */
    type?: 'ghost' | 'block' | 'pure';
}
declare const ActionIconGroup: import("react").NamedExoticComponent<ActionIconGroupProps>;
export default ActionIconGroup;
