import { memo, use, useEffect, useState } from "react";
import Masonry from "react-masonry-css";
import { fetchMockNotes, type Note, type NoteCategory } from "../mock";
import { ListItemComs } from "./ListItem";

type ListProps = {
  type: NoteCategory;
};
const breakpointColumnsObj = {
  default: 4,
  1100: 4,
  700: 4,
  500: 1,
};

export const QueryList = memo(function QueryList(props: ListProps) {
  const page = 1;
  const pageSize = 20;

  const [list, setList] = useState<Note[]>([]);

  const getList = async () => {
    const res = await fetchMockNotes(page, pageSize, props.type);
    setList(res.list);
  };

  useEffect(() => {
    getList();
  }, []);

  return (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="my-masonry-grid"
      columnClassName="my-masonry-grid_column"
    >
      {list.map((item) => (
        <ListItemComs key={item.id} item={item} />
      ))}
    </Masonry>
  );
});
