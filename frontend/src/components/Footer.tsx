import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-[var(--line)] bg-[#08090c]/90 text-[var(--muted)] text-sm py-16 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Col 1: Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4 group" aria-label="HireRank home">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-bold text-xs">
                HR
              </div>
              <span className="font-bold text-lg tracking-tight text-[var(--text)]">
                Hire<span className="text-[var(--accent)]">Rank</span>
              </span>
            </Link>
            <p className="text-[var(--muted)] text-sm max-w-sm leading-relaxed mb-4">
              AI-driven resume screening and ranking platform. Evaluate candidates on semantic fit, skill coverage, and real experience.
            </p>
            <span className="badge-mono text-[10px]">v2.4 Editorial Core</span>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text)] mb-4">Product</p>
            <ul className="space-y-2.5">
              <li>
                <Link to="/screen" className="hover:text-[var(--text)] transition-colors">
                  Screen Resumes
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-[var(--text)] transition-colors">
                  Recruiter Dashboard
                </Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-[var(--text)] transition-colors">
                  Create Workspace
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-[var(--text)] transition-colors">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Legal & Source */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text)] mb-4">Legal & Source</p>
            <ul className="space-y-2.5">
              <li>
                <Link to="/privacy" className="hover:text-[var(--text)] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-[var(--text)] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/atharv3046/HireRank"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--text)] transition-colors"
                >
                  GitHub Repository
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[var(--line)] pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <p>© {new Date().getFullYear()} HireRank. Final-Year Engineering Project. Built with React, FastAPI, and spaCy.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-[var(--text)] transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-[var(--text)] transition-colors">Terms</Link>
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              All systems operational
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

