import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col bg-transparent text-[var(--text)] font-sans antialiased">
      <Navbar minimal />
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="mb-4">
          <span className="font-serif-display text-8xl md:text-9xl font-normal text-[var(--accent)] tracking-tight">
            404
          </span>
        </div>
        <h1 className="font-serif-display text-3xl md:text-4xl font-normal text-[var(--text)] mb-3">
          Page not found
        </h1>
        <p className="text-[var(--muted)] text-sm mb-8 max-w-sm leading-relaxed">
          The requested route does not exist or has been relocated to another workspace.
        </p>
        <Link
          to="/"
          className="btn-primary text-xs py-2.5 px-5 gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
