export function About() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-900">关于</h1>
      <p className="text-gray-600">
        这是一个通用全栈脚手架，包含前后端分离架构。
      </p>

      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="font-semibold text-gray-800 mb-2">技术栈</h2>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          <li>前端：React 19 + TypeScript + Tailwind CSS v4 + React Router v7 + Zustand + Vite</li>
          <li>后端：NestJS</li>
          <li>包管理：pnpm</li>
        </ul>
      </div>
    </div>
  )
}
