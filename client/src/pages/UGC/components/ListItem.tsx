import { memo } from "react";
import type { Note } from "../mock";
import { Skeleton } from "antd";

export interface ListItem extends Note {}

export interface ListItemProps {
  item: ListItem;
}

export const ListItemComs = memo(function (props: ListItemProps) {
  return (
    <div className="flex flex-col gap-2 items-stretch h-64">
      <Skeleton.Image active={true} />
      <div className="flex-1 text-lg font-bold">{props.item.title}</div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-500 flex-1">
          {props.item.author.nickname}
        </div>
        <div className="text-sm text-gray-500">{props.item.category}</div>
      </div>
    </div>
  );
});
