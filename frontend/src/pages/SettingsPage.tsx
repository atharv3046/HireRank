import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import {
  api,
  CompanyProfile,
  TeamMember,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  useReducedMotion,
  fadeInUpVariants,
  staggerContainerVariants,
  modalBackdropVariants,
  modalContentVariants,
  tabContentVariants,
  listItemVariants,
} from '../utils/animations';

type SettingsTab = 'profile' | 'team';

export default function SettingsPage() {
  const { user } = useAuth();
  const shouldReduce = useReducedMotion();

  // Active tab state
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [loading, setLoading] = useState(true);

  // Profile tab state
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [copiedOrgId, setCopiedOrgId] = useState(false);

  // Team tab state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [seatUsage, setSeatUsage] = useState({ used: 1, total: 5, percentage: 20 });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Recruiter');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileData, teamData] = await Promise.all([
        api.getCompanyProfile().catch(() => null),
        api.getTeam().catch(() => null),
      ]);

      if (profileData) {
        setProfile(profileData);
        setWorkspaceName(profileData.workspace_name);
        setAdminEmail(profileData.admin_email);
        setDomain(profileData.domain);
      }

      if (teamData) {
        setTeamMembers(teamData.members || []);
        setSeatUsage(teamData.seat_usage || { used: 1, total: 5, percentage: 20 });
      }
    } catch (err) {
      console.error('Failed to load settings data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save Company Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(false);
    try {
      const updated = await api.updateCompanyProfile({
        workspace_name: workspaceName,
        admin_email: adminEmail,
        domain: domain,
      });
      setProfile(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save profile', err);
      alert(err.response?.data?.detail || 'Failed to update company profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Copy Org ID
  const handleCopyOrgId = () => {
    if (!profile?.org_id) return;
    navigator.clipboard.writeText(profile.org_id);
    setCopiedOrgId(true);
    setTimeout(() => setCopiedOrgId(false), 2000);
  };

  // Invite Team Member
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSendingInvite(true);
    setInviteError(null);
    try {
      const newMember = await api.inviteTeamMember({
        email: inviteEmail.trim(),
        role: inviteRole,
        name: inviteName.trim() || undefined,
      });
      setTeamMembers(prev => [...prev, newMember]);
      setSeatUsage(prev => ({
        ...prev,
        used: prev.used + 1,
        percentage: Math.round(((prev.used + 1) / prev.total) * 100),
      }));
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('Recruiter');
    } catch (err: any) {
      console.error('Invite failed', err);
      setInviteError(err.response?.data?.detail || 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  // Remove Team Member
  const handleRemoveMember = async (memberId: number) => {
    if (!window.confirm('Are you sure you want to remove this member from your workspace?')) return;
    try {
      await api.removeTeamMember(memberId);
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
      setSeatUsage(prev => ({
        ...prev,
        used: Math.max(1, prev.used - 1),
        percentage: Math.round(((Math.max(1, prev.used - 1)) / prev.total) * 100),
      }));
    } catch (err: any) {
      console.error('Remove member failed', err);
      alert(err.response?.data?.detail || 'Failed to remove team member');
    }
  };

  const userName = user?.email?.split('@')[0] || 'Atharv Ji';

  return (
    <div className="flex min-h-screen font-sans text-white" style={{ background: '#0a0a0f' }}>
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <div className="px-8 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-white/80">
              <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{profile?.workspace_name || 'Organization'}</span>
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-bold text-white capitalize">{userName}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">{user?.role || 'Admin'}</div>
            </div>
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black text-xs font-black">
                {userName.slice(0, 1).toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0a0a0f]" />
            </div>
          </div>
        </div>

        {/* Page Container */}
        <motion.div
          initial={shouldReduce ? false : 'hidden'}
          animate="visible"
          variants={staggerContainerVariants}
          className="p-8 max-w-6xl w-full mx-auto space-y-6"
        >
          {/* Header Title */}
          <motion.div variants={fadeInUpVariants}>
            <h1 className="text-2xl font-extrabold text-white">Team Settings</h1>
            <p className="text-xs text-white/40 mt-1">
              Manage your company workspace and team member permissions.
            </p>
          </motion.div>

          {/* Settings Tabs Bar */}
          <motion.div
            variants={fadeInUpVariants}
            className="flex items-center gap-2 border-b border-white/[0.08] pb-1"
          >
            {[
              { id: 'profile', label: 'Company Profile' },
              { id: 'team', label: `Team Members (${teamMembers.length})` },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`px-4 py-2.5 text-xs font-bold transition-all relative ${
                    isActive ? 'text-white' : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="settingsTabIndicator"
                      className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500"
                    />
                  )}
                </button>
              );
            })}
          </motion.div>

          {loading ? (
            <div className="py-24 text-center text-white/30">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading settings details...
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* ══════════════════════════════════════════════════════════════
                  TAB 1: COMPANY PROFILE
                  ══════════════════════════════════════════════════════════════ */}
              {activeTab === 'profile' && (
                <motion.div
                  key="profile-tab"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={tabContentVariants}
                  className="space-y-6"
                >
                  <form
                    onSubmit={handleSaveProfile}
                    className="p-6 rounded-2xl border border-white/[0.08] space-y-6"
                    style={{ background: '#0d0d14' }}
                  >
                    <div>
                      <h3 className="text-base font-bold text-white">Workspace Information</h3>
                      <p className="text-xs text-white/40 mt-0.5">
                        Update your company name, verified domain, and administrator credentials.
                      </p>
                    </div>

                    {profileSuccess && (
                      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Company profile changes have been successfully saved!
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Workspace Name */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">
                          Workspace Name
                        </label>
                        <input
                          type="text"
                          required
                          value={workspaceName}
                          onChange={e => setWorkspaceName(e.target.value)}
                          placeholder="e.g. Acme Corporation"
                          className="w-full px-3.5 py-2.5 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                      </div>

                      {/* Admin Email */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">
                          Primary Admin Email
                        </label>
                        <input
                          type="email"
                          required
                          value={adminEmail}
                          onChange={e => setAdminEmail(e.target.value)}
                          placeholder="admin@company.com"
                          className="w-full px-3.5 py-2.5 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                      </div>

                      {/* Domain */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">
                          Company Domain
                        </label>
                        <input
                          type="text"
                          value={domain}
                          onChange={e => setDomain(e.target.value)}
                          placeholder="company.com"
                          className="w-full px-3.5 py-2.5 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                      </div>

                      {/* Organization ID (Copyable) */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">
                          Organization Identifier
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={profile?.org_id || 'org_0001'}
                            className="w-full px-3.5 py-2.5 text-xs bg-white/[0.02] border border-white/[0.06] rounded-xl text-white/60 font-mono focus:outline-none cursor-default"
                          />
                          <button
                            type="button"
                            onClick={handleCopyOrgId}
                            className="flex-shrink-0 px-3 py-2.5 text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-white/80 rounded-xl border border-white/[0.1] transition-all"
                          >
                            {copiedOrgId ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
                      >
                        {savingProfile && (
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        )}
                        Save Profile Changes
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  TAB 2: TEAM MEMBERS
                  ══════════════════════════════════════════════════════════════ */}
              {activeTab === 'team' && (
                <motion.div
                  key="team-tab"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={tabContentVariants}
                  className="space-y-6"
                >
                  {/* Seat Usage Banner */}
                  <div
                    className="p-6 rounded-2xl border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4"
                    style={{ background: '#0d0d14' }}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                          Team Capacity
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        <span className="text-xs text-white/40">Active Workspace</span>
                      </div>
                      <h3 className="text-lg font-extrabold text-white">
                        {seatUsage.used} of {seatUsage.total} Seats Used
                      </h3>
                      <div className="w-48 bg-white/[0.06] rounded-full h-1.5 overflow-hidden mt-2">
                        <motion.div
                          className="h-full bg-cyan-400 rounded-full"
                          initial={{ width: '0%' }}
                          animate={{ width: `${seatUsage.percentage}%` }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-xl shadow-lg shadow-cyan-500/20 transition-all self-start md:self-auto"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Invite Member
                    </button>
                  </div>

                  {/* Team Members List */}
                  <div
                    className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-sm"
                    style={{ background: '#0d0d14' }}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/[0.06] bg-white/[0.01] text-[11px] font-bold text-white/40 uppercase tracking-wider">
                            <th className="py-4 px-6">MEMBER</th>
                            <th className="py-4 px-4">ROLE</th>
                            <th className="py-4 px-4 text-center">STATUS</th>
                            <th className="py-4 px-4">DATE ADDED</th>
                            <th className="py-4 pr-6 pl-4 text-right">ACTION</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-white/[0.06] text-xs">
                          {teamMembers.map((m, idx) => (
                            <motion.tr
                              key={m.id}
                              custom={idx}
                              variants={listItemVariants}
                              initial="hidden"
                              animate="visible"
                              className="hover:bg-white/[0.015] transition-colors"
                            >
                              {/* Member */}
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-extrabold text-xs">
                                    {(m.name || m.email).slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white flex items-center gap-2">
                                      <span>{m.name || m.email.split('@')[0]}</span>
                                      {m.is_primary && (
                                        <span className="text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                                          Workspace Owner
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-white/40 text-[11px] mt-0.5">{m.email}</div>
                                  </div>
                                </div>
                              </td>

                              {/* Role */}
                              <td className="py-4 px-4">
                                <span className="font-semibold text-white/80">{m.role}</span>
                              </td>

                              {/* Status */}
                              <td className="py-4 px-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                    m.status === 'Active'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      m.status === 'Active' ? 'bg-emerald-400' : 'bg-amber-400'
                                    }`}
                                  />
                                  {m.status}
                                </span>
                              </td>

                              {/* Date Added */}
                              <td className="py-4 px-4 text-white/40">{m.created_at}</td>

                              {/* Action */}
                              <td className="py-4 pr-6 pl-4 text-right">
                                {m.is_primary ? (
                                  <span className="text-white/20 italic">Primary</span>
                                ) : (
                                  <button
                                    onClick={() => handleRemoveMember(m.id)}
                                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                                  >
                                    Remove
                                  </button>
                                )}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>
      </main>

      {/* ── INVITE MEMBER MODAL ── */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-md rounded-2xl border border-white/[0.1] p-6 shadow-2xl space-y-5"
              style={{ background: '#0d0d14' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                    Workspace Collaboration
                  </span>
                  <h3 className="text-lg font-extrabold text-white">Invite Team Member</h3>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {inviteError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {inviteError}
                </div>
              )}

              <form onSubmit={handleInviteMember} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
                    Member Name
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="w-full px-3.5 py-2 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full px-3.5 py-2 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
                    Workspace Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-[#14141f] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 cursor-pointer"
                  >
                    <option value="Recruiter">Recruiter (Can screen & invite candidates)</option>
                    <option value="Admin">Admin (Full workspace access)</option>
                    <option value="Reviewer">Reviewer (Read-only ranking access)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white/40 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingInvite}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 text-white shadow-lg shadow-cyan-500/20 transition-all"
                  >
                    {sendingInvite && (
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    )}
                    Send Invitation
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
