import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="py-20 text-center space-y-4">
      <p className="text-6xl font-bold text-gray-300">404</p>
      <p className="text-gray-600">页面不存在</p>
      <Link to="/" className="text-sm text-indigo-600 hover:underline">
        返回首页
      </Link>
    </div>
  )
}
