import { Input } from "antd";
import { memo, useState } from "react";
import type { GetProps } from "antd";

type SearchProps = GetProps<typeof Input.Search>;

type Props = {
  onSearch: SearchProps["onSearch"];
};
export const QueryInput = memo(function QueryInput(props: Props) {
  return (
    <Input.Search
      placeholder="input search text"
      allowClear
      enterButton="Search"
      size="large"
      onSearch={props.onSearch}
    ></Input.Search>
  );
});
