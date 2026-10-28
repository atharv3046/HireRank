import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  minimal?: boolean;
}

export default function Navbar({ minimal = false }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isHome = location.pathname === '/' || location.pathname === '/marketing';

  const navLinks = [
    { label: 'How It Works', href: isHome ? '#how' : '/#how' },
    { label: 'Features', href: isHome ? '#features' : '/#features' },
    { label: 'Demo', href: isHome ? '#demo' : '/#demo' },
    { label: 'FAQ', href: isHome ? '#faq' : '/#faq' },
  ];

  return (
    <>
      <nav
        className={`sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 h-18 transition-all duration-200 ${
          scrolled
            ? 'bg-[#08090c]/90 backdrop-blur-md border-b border-[var(--line)] shadow-sm'
            : 'bg-transparent border-b border-[var(--line)]/50'
        }`}
        style={{ height: '4.5rem' }}
      >
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group" aria-label="HireRank home">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-bold text-xs transition-colors group-hover:border-[var(--accent)]/60">
            HR
          </div>
          <span className="font-bold text-lg tracking-tight text-[var(--text)] font-sans">
            Hire<span className="text-[var(--accent)]">Rank</span>
          </span>
        </Link>

        {/* Center Links (if not minimal) */}
        {!minimal && (
          <div className="hidden md:flex items-center gap-8 text-[14px]">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-[var(--muted)] hover:text-[var(--text)] transition-colors duration-150"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-[var(--line)] text-xs text-[var(--muted)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{user?.email || 'Recruiter'}</span>
              </div>
              <Link
                to="/dashboard"
                className="btn-ghost text-xs py-2 px-3.5 gap-1.5"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-[var(--accent)]" />
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="btn-ghost text-xs py-2 px-3 gap-1.5 text-[var(--muted)] hover:text-red-400"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-[14px] text-[var(--muted)] hover:text-[var(--text)] transition-colors duration-150 px-2 py-1"
              >
                Sign In
              </Link>
              <Link
                to="/screen"
                className="btn-primary text-xs py-2.5 px-4"
              >
                Screen Resumes
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden text-[var(--muted)] hover:text-[var(--text)] p-2 transition-colors rounded-lg border border-[var(--line)]"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" strokeWidth={1.8} />
        </button>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-[#08090c]/95 backdrop-blur-xl flex flex-col p-6">
          <div className="flex items-center justify-between pb-6 border-b border-[var(--line)]">
            <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-bold text-xs">
                HR
              </div>
              <span className="font-bold text-lg tracking-tight text-[var(--text)]">
                Hire<span className="text-[var(--accent)]">Rank</span>
              </span>
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="text-[var(--muted)] hover:text-[var(--text)] p-2 rounded-lg border border-[var(--line)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 py-8 flex flex-col gap-6 text-lg">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/screen"
              onClick={() => setMobileOpen(false)}
              className="text-[var(--text)]"
            >
              Screen Resumes
            </Link>
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="text-[var(--accent)]"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                Sign In
              </Link>
            )}
          </div>

          <div className="pt-6 border-t border-[var(--line)]">
            {isAuthenticated ? (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="btn-ghost w-full justify-center"
              >
                Log Out
              </button>
            ) : (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  navigate('/screen');
                }}
                className="btn-primary w-full justify-center"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
