import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="mb-8">
        <span className="text-8xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          404
        </span>
      </div>
      <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
      <p className="text-white/50 mb-8 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
      >
        Back to Home
      </Link>
    </div>
  );
}
