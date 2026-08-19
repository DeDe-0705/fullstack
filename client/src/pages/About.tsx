import { Card, Flex, List, Typography } from "antd";
import { useContext } from "react";
import { userConfigContext } from "../utils";

const STACK = [
  "前端：React 19 + TypeScript + Tailwind CSS v4 + React Router v7 + Zustand + Vite",
  "后端：NestJS",
  "包管理：pnpm",
];

export function About() {
  Function.prototype.myBind = function (_this: any, ...args: any[]) {
    const func = this; // 当前函数

    const bound = function (...args2: any[]) {
      // 如果当前是new 那么this就指向了bound.prototype, 否则指向_this
      return func.apply(this instanceof bound ? this : _this, [
        ...args,
        ...args2,
      ]);
    };
    if (func.prototype) {
      bound.prototype = Object.create(func.prototype);
    }

    return bound;
  };

  const target = {
    age: 0,
    constructor(age: number) {
      this.age = age ?? 16;
    },
  };
  const targetProxy = new Proxy(target, {
    get(target, prop, receiver) {
      console.log("get", prop);
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      console.log("set", prop, value);
      console.log(target);
      console.log(receiver);
      target[prop] = value;
      return true;
      // return Reflect.set(target, prop, value, receiver);
    },
  });

  const child = Object.create(targetProxy);
  const childb = Object.create(targetProxy);
  childb.age = 20;
  console.log(Object.getPrototypeOf(child));
  child.age = 18;
  console.log(child.age, 123);
  console.log(childb.age, 123);

  const userConfig = useContext(userConfigContext);

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={3}>关于</Typography.Title>
      <Typography.Paragraph type="secondary">
        这是一个通用全栈脚手架，包含前后端分离架构。{userConfig?.name}
      </Typography.Paragraph>
      <Card title="技术栈">
        <List
          dataSource={STACK}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </Card>
    </Flex>
  );
}
