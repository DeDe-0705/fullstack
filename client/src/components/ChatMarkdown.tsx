import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

interface ChatMarkdownProps {
  content: string;
}

// react-markdown：React 生态最主流的 Markdown 渲染器
// remark-gfm：表格/删除线/任务列表等 GitHub 风格扩展
// rehype-highlight：基于 highlight.js 的同步代码高亮（react-markdown 经典组合）
export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
