import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useReducedMotion } from '../utils/animations';
import {
  LayoutDashboard,
  FileCheck2,
  ClipboardList,
  Users,
  Briefcase,
  Settings,
  HelpCircle,
  LogOut,
  Plus
} from 'lucide-react';

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" strokeWidth={1.8} />,
  },
  {
    to: '/resume-screenings',
    label: 'Resume Screenings',
    icon: <FileCheck2 className="w-4 h-4" strokeWidth={1.8} />,
  },
  {
    to: '/assessments',
    label: 'Assessments',
    icon: <ClipboardList className="w-4 h-4" strokeWidth={1.8} />,
  },
  {
    to: '/candidate-pipeline',
    label: 'Candidate Pipeline',
    icon: <Users className="w-4 h-4" strokeWidth={1.8} />,
  },
  {
    to: '/jobs',
    label: 'Job Postings',
    icon: <Briefcase className="w-4 h-4" strokeWidth={1.8} />,
  },
  {
    to: '/settings',
    label: 'Team Settings',
    icon: <Settings className="w-4 h-4" strokeWidth={1.8} />,
  },
];

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col h-screen sticky top-0 border-r border-[var(--line)] bg-[#08090c] z-30"
    >
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-[var(--line)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-bold text-xs">
            HR
          </div>
          <div>
            <div className="font-bold text-[var(--text)] leading-none text-base">
              Hire<span className="text-[var(--accent)]">Rank</span>
            </div>
            <div className="text-[11px] text-[var(--muted)] mt-1 truncate max-w-[140px]">
              {user?.email?.split('@')[1] || 'Recruiter Workspace'}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => navigate('/screen')}
          className="btn-primary w-full text-xs py-2.5 px-3 rounded-[10px] justify-center"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          Screen Resumes
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] px-3 mb-2">
          Workspace
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors ${
                isActive
                  ? 'text-[var(--accent)] font-semibold'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/[0.03]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId={shouldReduce ? undefined : 'active-nav-indicator'}
                    className="absolute inset-0 rounded-[10px] bg-[var(--accent-dim)] border border-[var(--accent)]/30"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 transition-colors ${isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                  {item.icon}
                </span>
                <span className="relative z-10">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Help Link */}
      <div className="px-3 mb-1">
        <a
          href="mailto:support@hirerank.ai"
          className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)] transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-[var(--muted)]" strokeWidth={1.8} />
          Support & Help
        </a>
      </div>

      {/* Footer / Account / Logout */}
      <div className="px-3 pb-4 space-y-1 border-t border-[var(--line)] pt-3">
        <a
          href="https://github.com/atharv3046/HireRank"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-[10px] text-xs text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)] transition-colors"
        >
          <svg className="w-4 h-4 fill-current text-[var(--muted)]" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          GitHub Repository
        </a>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-xs text-[var(--muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.8} />
          Log Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
