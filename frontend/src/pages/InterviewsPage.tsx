import React, { useCallback, useEffect, useState, useMemo } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import Sidebar from '../components/Sidebar';

import {

  api,

  AssessmentRead,

  InterviewInvitationRead,

  InterviewSlotRead,

  InterviewQuestionInfo,

} from '../api/client';

import { useReducedMotion, fadeInUpVariants, staggerContainerVariants } from '../utils/animations';



/* ─── Status badges & helpers ─────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; badgeCls: string; dotCls: string }> = {

  completed: {

    label: 'Ready for Review',

    badgeCls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',

    dotCls: 'bg-emerald-400',

  },

  booked: {

    label: 'Meeting Slot Booked',

    badgeCls: 'bg-sky-500/10 text-sky-400 border-sky-500/30',

    dotCls: 'bg-sky-400',

  },

  started: {

    label: 'In Progress',

    badgeCls: 'bg-amber-500/10 text-amber-300 border-amber-500/30',

    dotCls: 'bg-amber-400',

  },

  invited: {

    label: 'Invited · Pending',

    badgeCls: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',

    dotCls: 'bg-indigo-400',

  },

  delivery_failed: {

    label: 'Delivery Issue',

    badgeCls: 'bg-rose-500/10 text-rose-300 border-rose-500/30',

    dotCls: 'bg-rose-400',

  },

  expired: {

    label: 'Expired',

    badgeCls: 'bg-white/[0.04] text-white/40 border-white/10',

    dotCls: 'bg-white/30',

  },

};



const RATING_LABELS: Record<number, string> = {

  1: '1 · Needs Improvement',

  2: '2 · Below Expectations',

  3: '3 · Meets Expectations',

  4: '4 · Strong Match',

  5: '5 · Exceptional',

};



const AVATAR_COLORS = [

  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',

  'bg-sky-500/15 text-sky-300 border-sky-500/30',

  'bg-violet-500/15 text-violet-300 border-violet-500/30',

  'bg-amber-500/15 text-amber-300 border-amber-500/30',

  'bg-rose-500/15 text-rose-300 border-rose-500/30',

];



function getInitials(name?: string | null, email?: string): string {

  if (name && name.trim()) {

    const parts = name.trim().split(/\s+/);

    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();

    return parts[0].slice(0, 2).toUpperCase();

  }

  if (email) return email.slice(0, 2).toUpperCase();

  return 'CD';

}



function countWords(str: string): number {

  if (!str) return 0;

  return str.trim().split(/\s+/).filter(Boolean).length;

}



/* ─── Interactive Star Rating ────────────────────────────────────────── */

function StarRating({

  value,

  onChange,

  disabled = false,

}: {

  value: number;

  onChange: (v: number) => void;

  disabled?: boolean;

}) {

  const [hovered, setHovered] = useState(0);

  const activeRating = hovered || value;



  return (

    <div className="flex items-center gap-3">

      <div className="flex items-center gap-1.5" onMouseLeave={() => setHovered(0)}>

        {[1, 2, 3, 4, 5].map((n) => (

          <button

            key={n}

            type="button"

            disabled={disabled}

            onClick={() => onChange(n)}

            onMouseEnter={() => setHovered(n)}

            className={`p-1 rounded-lg transition-transform focus:outline-none ${

              disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-110 active:scale-95'

            }`}

          >

            <svg

              className={`w-6 h-6 transition-colors ${

                n <= activeRating ? 'text-amber-400 fill-amber-400' : 'text-white/20 fill-transparent'

              }`}

              viewBox="0 0 24 24"

              stroke="currentColor"

              strokeWidth={n <= activeRating ? 0 : 1.5}

            >

              <path

                strokeLinecap="round"

                strokeLinejoin="round"

                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"

              />

            </svg>

          </button>

        ))}

      </div>

      <span className="text-xs font-semibold text-amber-300/90">

        {RATING_LABELS[activeRating] || `${activeRating} / 5`}

      </span>

    </div>

  );

}



/* ─── Main Component ─────────────────────────────────────────────────── */

export default function InterviewsPage() {

  const shouldReduce = useReducedMotion();



  // Data states

  const [assessments, setAssessments] = useState<AssessmentRead[]>([]);

  const [invites, setInvites] = useState<InterviewInvitationRead[]>([]);

  const [slots, setSlots] = useState<InterviewSlotRead[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [notice, setNotice] = useState('');

  const [busy, setBusy] = useState(false);



  // Selection & filtering states

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [assessmentFilter, setAssessmentFilter] = useState<number | 'all'>('all');

  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_review' | 'booked' | 'evaluated' | 'pending'>('all');



  // Slot scheduling drawer state

  const [showSlotForm, setShowSlotForm] = useState(false);

  const [slotAssessmentId, setSlotAssessmentId] = useState<number | null>(null);

  const [slotStartsAt, setSlotStartsAt] = useState('');

  const [slotDuration, setSlotDuration] = useState(30);

  const [slotMeetingUrl, setSlotMeetingUrl] = useState('');



  // Per-invitation evaluation draft state

  const [reviews, setReviews] = useState<Record<number, { rating: number; decision: string; notes: string }>>({});

  const [activeQuestionTab, setActiveQuestionTab] = useState<string | 'all'>('all');

  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [editingEmailInviteId, setEditingEmailInviteId] = useState<number | null>(null);
  const [newEmailInput, setNewEmailInput] = useState('');



  // Load all assessment & interview data

  const refresh = useCallback(async () => {

    setError('');

    try {

      const [assessmentsData, invitesData] = await Promise.all([

        api.getAssessments(),

        api.getInterviewInvitations(),

      ]);

      setAssessments(assessmentsData || []);

      setInvites(invitesData || []);

      if (assessmentsData?.length > 0 && !slotAssessmentId) {

        setSlotAssessmentId(assessmentsData[0].id);

      }

      if (invitesData?.length > 0 && selectedId === null) {

        setSelectedId(invitesData[0].id);

      }

    } catch (e: any) {

      setError(e?.response?.data?.detail || 'Could not load interview workspace.');

    } finally {

      setLoading(false);

    }

  }, [selectedId, slotAssessmentId]);



  useEffect(() => {

    refresh();

  }, [refresh]);



  // Load slot availability whenever selected assessment changes

  useEffect(() => {

    if (!slotAssessmentId) return;

    api

      .getInterviewSlotAvailability(slotAssessmentId)

      .then(setSlots)

      .catch(() => {});

  }, [slotAssessmentId]);



  // Add interview slot

  const handleAddSlot = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!slotAssessmentId || !slotStartsAt) return;

    setBusy(true);

    setError('');

    setNotice('');

    try {

      await api.createInterviewSlot(slotAssessmentId, {

        starts_at: new Date(slotStartsAt).toISOString(),

        duration_minutes: slotDuration,

        meeting_url: slotMeetingUrl.trim(),

      });

      setNotice('Interview time added. Candidates can book this slot after submitting their responses.');

      setSlotStartsAt('');

      setSlotMeetingUrl('');

      setSlots(await api.getInterviewSlotAvailability(slotAssessmentId));

    } catch (e: any) {

      setError(e?.response?.data?.detail || 'Could not add this interview slot.');

    } finally {

      setBusy(false);

    }

  };



  // Save candidate evaluation

  const handleSaveReview = async (invite: InterviewInvitationRead, overrideDraft?: { rating: number; decision: string; notes: string }) => {

    const draft = overrideDraft || reviews[invite.id] || {

      rating: invite.rating || 3,

      decision: invite.decision || 'advance',

      notes: invite.notes || '',

    };



    // If declining, confirm with recruiter

    if (draft.decision === 'decline') {

      const candidateName = invite.candidate_name || invite.candidate_email;

      const ok = window.confirm(`Decline candidate "${candidateName}"?\n\nThis will mark them as "No Hire" and immediately remove them from the interview panel.`);

      if (!ok) return;

    }



    setBusy(true);

    setError('');

    setNotice('');

    try {

      const res = await api.reviewInterviewInvitation(invite.id, draft);

      if (draft.decision === 'decline' || (res as any)?.removed) {

        // Candidate declined -> REMOVE candidate immediately from the interview panel!

        setInvites((prev) => prev.filter((i) => i.id !== invite.id));

        const remaining = invites.filter((i) => i.id !== invite.id);

        setSelectedId(remaining[0]?.id ?? null);

        setNotice(`Candidate ${invite.candidate_name || invite.candidate_email} was declined and removed from the interview workspace.`);

      } else {

        setNotice(`Evaluation saved for ${invite.candidate_name || invite.candidate_email}. Candidate status updated.`);

        setInvites((prev) =>

          prev.map((i) =>

            i.id === invite.id

              ? { ...i, rating: draft.rating, decision: draft.decision, notes: draft.notes }

              : i

          )

        );

      }

    } catch (e: any) {

      setError(e?.response?.data?.detail || 'Could not save the evaluation.');

    } finally {

      setBusy(false);

    }

  };



  // Resend or regenerate interview link

  const handleResend = async (invite: InterviewInvitationRead, customEmail?: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const emailToUse = customEmail?.trim() || undefined;
      const res = await api.resendInterviewInvitation(invite.id, emailToUse);
      if (res.sent) {
        setNotice(`Interview invitation successfully emailed to ${res.candidate_email || invite.candidate_email}.`);
        setEditingEmailInviteId(null);
      } else {
        setError(`Email delivery failed: ${res.error || 'Check recipient email address.'}`);
        if (res.invite_url) {
          navigator.clipboard.writeText(res.invite_url);
          setCopiedLink(res.invite_url);
          setTimeout(() => setCopiedLink(null), 3000);
        }
      }
      refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not resend invitation.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteInvitation = async (invite: InterviewInvitationRead) => {

    const label = invite.candidate_name || invite.candidate_email;

    if (!window.confirm(`Delete interview invitation for "${label}"? This will permanently remove their answers and evaluations.`)) {

      return;

    }

    try {

      await api.deleteInterviewInvitation(invite.id);

      setInvites((prev) => prev.filter((i) => i.id !== invite.id));

      if (selectedId === invite.id) {

        const remaining = invites.filter((i) => i.id !== invite.id);

        setSelectedId(remaining[0]?.id ?? null);

      }

      setNotice(`Deleted interview record for ${label}.`);

    } catch (e: any) {

      setError(e?.response?.data?.detail || 'Failed to delete interview invitation.');

    }

  };



  // Copy candidate link to clipboard

  const handleCopyLink = (url: string) => {

    navigator.clipboard.writeText(url);

    setCopiedLink(url);

    setTimeout(() => setCopiedLink(null), 2500);

  };



  // Filtered invitations for left panel

  const filteredInvites = useMemo(() => {

    return invites.filter((inv) => {

      // Assessment filter

      if (assessmentFilter !== 'all' && inv.assessment_id !== assessmentFilter) {

        return false;

      }

      // Status tab filter

      if (statusFilter === 'needs_review') {

        const hasAnswers = inv.answers && Object.keys(inv.answers).length > 0;

        const notReviewed = !inv.rating;

        if (!hasAnswers || !notReviewed) return false;

      } else if (statusFilter === 'booked') {

        if (inv.status !== 'booked' && !inv.interview) return false;

      } else if (statusFilter === 'evaluated') {

        if (!inv.rating && !inv.decision) return false;

      } else if (statusFilter === 'pending') {

        if (inv.status === 'completed' || inv.status === 'booked') return false;

      }



      // Search query filter

      if (searchQuery.trim()) {

        const q = searchQuery.toLowerCase().trim();

        const nameMatch = (inv.candidate_name || '').toLowerCase().includes(q);

        const emailMatch = (inv.candidate_email || '').toLowerCase().includes(q);

        const titleMatch = (inv.assessment_title || '').toLowerCase().includes(q);

        if (!nameMatch && !emailMatch && !titleMatch) return false;

      }

      return true;

    });

  }, [invites, assessmentFilter, statusFilter, searchQuery]);



  // Currently active candidate

  const currentInvite = useMemo(() => {

    if (selectedId === null) return filteredInvites[0] || null;

    return invites.find((i) => i.id === selectedId) || null;

  }, [invites, filteredInvites, selectedId]);



  // Overall metric counters

  const totalCount = invites.length;

  const readyToReviewCount = invites.filter((i) => i.answers && Object.keys(i.answers).length > 0 && !i.rating).length;

  const bookedCount = invites.filter((i) => i.status === 'booked' || Boolean(i.interview)).length;

  const evaluatedCount = invites.filter((i) => Boolean(i.rating)).length;



  // Active candidate's questions and review draft

  const currentQuestions: InterviewQuestionInfo[] = currentInvite?.questions || [];

  const currentAnswers = currentInvite?.answers || {};

  const currentDraft = currentInvite

    ? reviews[currentInvite.id] || {

        rating: currentInvite.rating || 3,

        decision: currentInvite.decision || 'advance',

        notes: currentInvite.notes || '',

      }

    : { rating: 3, decision: 'advance', notes: '' };



  const setDraftField = (field: 'rating' | 'decision' | 'notes', val: any) => {

    if (!currentInvite) return;

    setReviews((prev) => ({

      ...prev,

      [currentInvite.id]: {

        ...currentDraft,

        [field]: val,

      },

    }));

  };



  const inputStyle =

    'w-full rounded-xl border border-[var(--line)] bg-white/[0.04] px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/50 transition-colors';



  return (

    <div className="flex h-screen overflow-hidden font-sans text-white" style={{ background: 'transparent' }}>

      <Sidebar />



      {/* Main Container */}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top Header Bar ── */}

        <header className="px-8 py-4 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-4 flex-shrink-0" style={{ background: '#0a0a0f' }}>

          <div>

            <div className="flex items-center gap-2">

              <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest">

                Interview Panel

              </span>

              <span className="w-1 h-1 rounded-full bg-white/20" />

              <span className="text-xs text-white/40">Recruiting Workspace</span>

            </div>

            <h1 className="font-serif-display text-2xl font-normal text-white tracking-tight mt-0.5">

              Candidate Interviews & Scorecards

            </h1>

          </div>



          <div className="flex items-center gap-2.5">

            {/* Toggle slot management button */}

            <button

              onClick={() => setShowSlotForm((prev) => !prev)}

              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${

                showSlotForm

                  ? 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/30'

                  : 'bg-white/[0.04] text-white/70 hover:text-white border-[var(--line)] hover:border-white/20'

              }`}

            >

              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />

              </svg>

              <span>Offer Meeting Slots ({slots.length})</span>

            </button>



            {/* Refresh button */}

            <button

              onClick={() => {

                setLoading(true);

                refresh();

              }}

              title="Refresh interviews"

              className="p-2 rounded-xl border border-[var(--line)] bg-white/[0.04] text-white/60 hover:text-white hover:border-white/20 transition-colors"

            >

              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />

              </svg>

            </button>

          </div>

        </header>



        {/* Global Notifications */}

        <AnimatePresence>

          {error && (

            <motion.div

              initial={{ opacity: 0, height: 0 }}

              animate={{ opacity: 1, height: 'auto' }}

              exit={{ opacity: 0, height: 0 }}

              className="bg-rose-500/10 border-b border-rose-500/20 px-8 py-2.5 text-xs text-rose-300 flex items-center justify-between"

            >

              <div className="flex items-center gap-2">

                <span className="font-bold">Error:</span>

                <span>{error}</span>

              </div>

              <button onClick={() => setError('')} className="text-rose-300 hover:text-white font-bold text-xs">✕</button>

            </motion.div>

          )}

          {notice && (

            <motion.div

              initial={{ opacity: 0, height: 0 }}

              animate={{ opacity: 1, height: 'auto' }}

              exit={{ opacity: 0, height: 0 }}

              className="bg-emerald-500/10 border-b border-emerald-500/20 px-8 py-2.5 text-xs text-emerald-300 flex items-center justify-between"

            >

              <div className="flex items-center gap-2">

                <span className="w-2 h-2 rounded-full bg-emerald-400" />

                <span>{notice}</span>

              </div>

              <button onClick={() => setNotice('')} className="text-emerald-300 hover:text-white font-bold text-xs">✕</button>

            </motion.div>

          )}

        </AnimatePresence>



        {/* ── Collapsible Live Slot Form Drawer ── */}

        <AnimatePresence>

          {showSlotForm && (

            <motion.section

              initial={{ opacity: 0, height: 0 }}

              animate={{ opacity: 1, height: 'auto' }}

              exit={{ opacity: 0, height: 0 }}

              className="border-b border-[var(--line)] bg-[#0d0d14] px-8 py-5 overflow-hidden flex-shrink-0"

            >

              <div className="max-w-7xl mx-auto space-y-4">

                <div className="flex items-center justify-between">

                  <div>

                    <h3 className="text-sm font-bold text-white flex items-center gap-2">

                      <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />

                      Add Available Interview Meeting Times (Google Meet / Zoom)

                    </h3>

                    <p className="text-xs text-white/40 mt-0.5">

                      Candidates select one of these slots to discuss their assessment after completing written questions.

                    </p>

                  </div>

                  <button

                    onClick={() => setShowSlotForm(false)}

                    className="text-xs text-white/40 hover:text-white"

                  >

                    Close panel ✕

                  </button>

                </div>



                <form onSubmit={handleAddSlot} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

                  <div>

                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">

                      Assessment

                    </label>

                    <select

                      value={slotAssessmentId ?? ''}

                      onChange={(e) => setSlotAssessmentId(Number(e.target.value))}

                      className={inputStyle}

                    >

                      {assessments.map((a) => (

                        <option key={a.id} value={a.id}>

                          {a.title}

                        </option>

                      ))}

                    </select>

                  </div>



                  <div>

                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">

                      Date & Time

                    </label>

                    <input

                      required

                      type="datetime-local"

                      value={slotStartsAt}

                      onChange={(e) => setSlotStartsAt(e.target.value)}

                      className={inputStyle}

                    />

                  </div>



                  <div>

                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">

                      Duration

                    </label>

                    <select

                      value={slotDuration}

                      onChange={(e) => setSlotDuration(Number(e.target.value))}

                      className={inputStyle}

                    >

                      <option value={15}>15 minutes</option>

                      <option value={30}>30 minutes</option>

                      <option value={45}>45 minutes</option>

                      <option value={60}>60 minutes</option>

                      <option value={90}>90 minutes</option>

                    </select>

                  </div>



                  <div className="lg:col-span-1">

                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">

                      Meeting Link (Google Meet / Zoom)

                    </label>

                    <input

                      required

                      type="url"

                      pattern="https://.*"

                      placeholder="https://meet.google.com/..."

                      value={slotMeetingUrl}

                      onChange={(e) => setSlotMeetingUrl(e.target.value)}

                      className={inputStyle}

                    />

                  </div>



                  <div className="flex items-end">

                    <button

                      type="submit"

                      disabled={busy || !slotAssessmentId}

                      className="w-full py-2 px-4 rounded-xl text-xs font-bold bg-[var(--accent)] text-[#04110f] hover:brightness-110 disabled:opacity-50 transition-all"

                    >

                      {busy ? 'Saving...' : '+ Add Slot'}

                    </button>

                  </div>

                </form>



                {/* Slots preview pills */}

                {slots.length > 0 && (

                  <div className="pt-2 border-t border-[var(--line)] flex flex-wrap items-center gap-2">

                    <span className="text-[11px] text-white/40 font-medium mr-1">Scheduled Slots:</span>

                    {slots.map((s) => (

                      <span

                        key={s.id}

                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border ${

                          s.booked

                            ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'

                            : 'bg-white/[0.03] border-[var(--line)] text-white/60'

                        }`}

                      >

                        <span className={`w-1.5 h-1.5 rounded-full ${s.booked ? 'bg-sky-400' : 'bg-emerald-400'}`} />

                        {new Date(s.starts_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}

                        <span className="text-white/30">·</span>

                        {s.duration_minutes}m

                        <span className="text-white/30">·</span>

                        <strong className={s.booked ? 'text-sky-300' : 'text-white/70'}>

                          {s.booked ? 'Booked' : 'Available'}

                        </strong>

                      </span>

                    ))}

                  </div>

                )}

              </div>

            </motion.section>

          )}

        </AnimatePresence>



        {/* ── Main Master-Detail Split Workspace ── */}

        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ════════ LEFT PANEL: Candidate List (380px) ════════ */}

          <aside

            className="w-80 lg:w-96 flex-shrink-0 flex flex-col border-r border-[var(--line)] min-h-0"

            style={{ background: '#0a0a0f' }}

          >

            {/* Metrics Quick Strip */}

            <div className="p-4 border-b border-[var(--line)] grid grid-cols-4 gap-2 text-center bg-white/[0.01]">

              <div className="p-2 rounded-xl bg-white/[0.02] border border-[var(--line)]">

                <div className="text-sm font-bold text-white">{totalCount}</div>

                <div className="text-[9px] uppercase tracking-wider text-white/40">Total</div>

              </div>

              <div className="p-2 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20">

                <div className="text-sm font-bold text-emerald-400">{readyToReviewCount}</div>

                <div className="text-[9px] uppercase tracking-wider text-emerald-400/70">To Review</div>

              </div>

              <div className="p-2 rounded-xl bg-sky-500/[0.05] border border-sky-500/20">

                <div className="text-sm font-bold text-sky-400">{bookedCount}</div>

                <div className="text-[9px] uppercase tracking-wider text-sky-400/70">Booked</div>

              </div>

              <div className="p-2 rounded-xl bg-amber-500/[0.05] border border-amber-500/20">

                <div className="text-sm font-bold text-amber-300">{evaluatedCount}</div>

                <div className="text-[9px] uppercase tracking-wider text-amber-300/70">Graded</div>

              </div>

            </div>



            {/* Search & Filter Header */}

            <div className="p-4 border-b border-[var(--line)] space-y-3">

              {/* Search input */}

              <div className="relative">

                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">

                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />

                  </svg>

                </div>

                <input

                  type="text"

                  value={searchQuery}

                  onChange={(e) => setSearchQuery(e.target.value)}

                  placeholder="Search candidate or email..."

                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/[0.04] border border-[var(--line)] rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"

                />

              </div>



              {/* Assessment filter dropdown if multiple */}

              {assessments.length > 1 && (

                <div className="relative">

                  <select

                    value={assessmentFilter}

                    onChange={(e) => setAssessmentFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}

                    className="w-full text-xs bg-white/[0.04] border border-[var(--line)] rounded-xl px-3 py-1.5 text-white/80 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 appearance-none cursor-pointer"

                  >

                    <option value="all">All Assessments ({assessments.length})</option>

                    {assessments.map((a) => (

                      <option key={a.id} value={a.id}>

                        {a.title}

                      </option>

                    ))}

                  </select>

                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-white/30">

                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />

                    </svg>

                  </div>

                </div>

              )}



              {/* Status Filter Pills */}

              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[11px]">

                <button

                  onClick={() => setStatusFilter('all')}

                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${

                    statusFilter === 'all'

                      ? 'bg-white text-black font-bold shadow-sm'

                      : 'text-white/50 hover:text-white hover:bg-white/[0.04]'

                  }`}

                >

                  All ({invites.length})

                </button>

                <button

                  onClick={() => setStatusFilter('needs_review')}

                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${

                    statusFilter === 'needs_review'

                      ? 'bg-emerald-400 text-black font-bold shadow-sm'

                      : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10'

                  }`}

                >

                  To Review ({readyToReviewCount})

                </button>

                <button

                  onClick={() => setStatusFilter('booked')}

                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${

                    statusFilter === 'booked'

                      ? 'bg-sky-400 text-black font-bold shadow-sm'

                      : 'text-sky-400/80 hover:text-sky-300 hover:bg-sky-500/10'

                  }`}

                >

                  Booked ({bookedCount})

                </button>

                <button

                  onClick={() => setStatusFilter('evaluated')}

                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${

                    statusFilter === 'evaluated'

                      ? 'bg-amber-400 text-black font-bold shadow-sm'

                      : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'

                  }`}

                >

                  Graded ({evaluatedCount})

                </button>

              </div>

            </div>



            {/* Candidates Scrollable List */}

            <div className="flex-1 overflow-y-auto p-3 space-y-2">

              {loading ? (

                <div className="py-20 text-center text-white/30 text-xs flex flex-col items-center gap-2">

                  <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />

                  Loading candidate records...

                </div>

              ) : filteredInvites.length === 0 ? (

                <div className="py-16 text-center text-white/40 text-xs px-4">

                  <p className="font-semibold text-white/60 mb-1">No candidate matches</p>

                  <p>Try clearing filters or search term.</p>

                </div>

              ) : (

                filteredInvites.map((invite, idx) => {

                  const isSelected = currentInvite?.id === invite.id;

                  const initials = getInitials(invite.candidate_name, invite.candidate_email);

                  const colorCls = AVATAR_COLORS[idx % AVATAR_COLORS.length];

                  const statusInfo = STATUS_CONFIG[invite.status] || {

                    label: invite.status.replace(/_/g, ' '),

                    badgeCls: 'bg-white/[0.04] text-white/60 border-white/10',

                    dotCls: 'bg-white/40',

                  };

                  const answerCount = invite.answers ? Object.keys(invite.answers).length : 0;

                  const isReady = answerCount > 0 && !invite.rating;



                  return (

                    <div

                      key={invite.id}

                      onClick={() => setSelectedId(invite.id)}

                      className={`p-3.5 rounded-xl cursor-pointer transition-all border text-left relative group ${

                        isSelected

                          ? 'bg-[var(--accent-dim)] border-[var(--accent)]/30 shadow-none'

                          : 'bg-white/[0.02] border-[var(--line)] hover:bg-white/[0.04] hover:border-white/[0.1]'

                      }`}

                    >

                      {/* Active indicator bar */}

                      {isSelected && (

                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-[var(--accent)] rounded-r" />

                      )}



                      <div className="flex items-start gap-3">

                        {/* Avatar */}

                        <div

                          className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 ${colorCls}`}

                        >

                          {initials}

                        </div>



                        {/* Candidate info */}

                        <div className="min-w-0 flex-1">

                          <div className="flex items-center justify-between gap-1">

                            <h4 className="font-bold text-sm text-white truncate">

                              {invite.candidate_name || invite.candidate_email}

                            </h4>

                            {/* Delete icon on hover */}

                            <button

                              onClick={(e) => {

                                e.stopPropagation();

                                handleDeleteInvitation(invite);

                              }}

                              title="Delete interview record"

                              className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-rose-400 transition-opacity"

                            >

                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />

                              </svg>

                            </button>

                          </div>



                          <p className="text-[11px] text-white/40 truncate mt-0.5">

                            {invite.candidate_email}

                          </p>



                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">

                            {/* Status badge */}

                            <span

                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusInfo.badgeCls}`}

                            >

                              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotCls}`} />

                              {statusInfo.label}

                            </span>



                            {/* Response counter */}

                            {answerCount > 0 && (

                              <span className="text-[10px] bg-white/[0.05] border border-[var(--line)] text-white/70 px-1.5 py-0.5 rounded-md font-mono">

                                {answerCount} answers

                              </span>

                            )}



                            {/* Rating star preview */}

                            {invite.rating && (

                              <span className="text-[10px] font-bold text-amber-300 ml-auto flex items-center gap-0.5">

                                ★ {invite.rating}/5

                              </span>

                            )}



                            {/* Decision badge preview */}

                            {invite.decision && (

                              <span

                                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${

                                  invite.decision === 'advance'

                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'

                                    : invite.decision === 'decline'

                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'

                                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'

                                }`}

                              >

                                {invite.decision}

                              </span>

                            )}

                          </div>

                        </div>

                      </div>

                    </div>

                  );

                })

              )}

            </div>

          </aside>



          {/* ════════ RIGHT PANEL: Interview Evaluation & Responses ════════ */}

          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto" style={{ background: '#07070b' }}>

            {!currentInvite ? (

              <div className="flex-1 flex items-center justify-center p-8 text-center">

                <div className="max-w-md space-y-3">

                  <div className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center mx-auto">

                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />

                    </svg>

                  </div>

                  <h3 className="text-lg font-bold text-white">Select a Candidate Interview</h3>

                  <p className="text-xs text-white/40">

                    Pick a candidate from the left list to review their written question answers, inspect video booking, and record scorecard decisions.

                  </p>

                </div>

              </div>

            ) : (

              <motion.div

                key={currentInvite.id}

                initial={shouldReduce ? false : 'hidden'}

                animate="visible"

                variants={staggerContainerVariants}

                className="p-8 max-w-5xl w-full mx-auto space-y-6"

              >

                {/* ── Candidate Dossier Header Card ── */}

                <motion.div

                  variants={fadeInUpVariants}

                  className="rounded-2xl border border-[var(--line)] p-6 space-y-4"

                  style={{ background: '#0e0e16' }}

                >

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

                    <div className="flex items-start gap-4">

                      <div className="w-12 h-12 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center text-base font-mono font-bold flex-shrink-0">

                        {getInitials(currentInvite.candidate_name, currentInvite.candidate_email)}

                      </div>

                      <div>

                        <div className="flex items-center gap-2 flex-wrap">

                          <h2 className="text-xl font-bold text-white">

                            {currentInvite.candidate_name || currentInvite.candidate_email}

                          </h2>

                          {(() => {

                            const cfg = STATUS_CONFIG[currentInvite.status] || {

                              label: currentInvite.status,

                              badgeCls: 'bg-white/[0.04] text-white/60 border-white/10',

                              dotCls: 'bg-white/40',

                            };

                            return (

                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.badgeCls}`}>

                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotCls}`} />

                                {cfg.label}

                              </span>

                            );

                          })()}

                        </div>



                        <p className="text-xs text-white/50 mt-1 flex items-center gap-2 flex-wrap">

                          {editingEmailInviteId === currentInvite.id ? (
                            <span className="inline-flex items-center gap-1.5 bg-white/[0.06] p-1 rounded-lg border border-indigo-500/40">
                              <input
                                type="email"
                                value={newEmailInput}
                                onChange={(e) => setNewEmailInput(e.target.value)}
                                placeholder="name@domain.com"
                                className="px-2 py-0.5 text-xs bg-black/40 border border-white/20 rounded text-white focus:outline-none focus:border-indigo-400"
                                autoFocus
                              />
                              <button
                                type="button"
                                disabled={busy || !newEmailInput.includes('@')}
                                onClick={() => handleResend(currentInvite, newEmailInput)}
                                className="px-2 py-0.5 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded disabled:opacity-50"
                              >
                                {busy ? 'Sending...' : 'Save & Send'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingEmailInviteId(null)}
                                className="text-white/40 hover:text-white px-1 text-xs"
                              >
                                ✕
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 group">
                              <span className="font-mono text-white/70">{currentInvite.candidate_email}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingEmailInviteId(currentInvite.id);
                                  setNewEmailInput(currentInvite.candidate_email);
                                }}
                                title="Edit candidate email address & resend"
                                className="text-white/40 hover:text-indigo-400 text-xs transition-colors px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/10"
                              >
                                ✎ Edit Email
                              </button>
                            </span>
                          )}

                          <span className="text-white/20">·</span>

                          <span className="text-white/70 font-semibold">{currentInvite.assessment_title}</span>

                          {currentInvite.submitted_at && (

                            <>

                              <span className="text-white/20">·</span>

                              <span className="text-emerald-400/80">

                                Submitted {new Date(currentInvite.submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}

                              </span>

                            </>

                          )}

                        </p>

                      </div>

                    </div>



                    {/* Quick action buttons */}

                    <div className="flex items-center gap-2 flex-shrink-0">

                      <button

                        onClick={() => handleResend(currentInvite)}

                        disabled={busy}

                        title="Resend email or generate new secure link"

                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--line)] text-white/70 hover:text-white transition-all disabled:opacity-50"

                      >

                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />

                        </svg>

                        <span>Resend / Copy Link</span>

                      </button>



                      <button

                        onClick={() => {

                          handleSaveReview(currentInvite, {

                            rating: currentDraft.rating || 1,

                            decision: 'decline',

                            notes: currentDraft.notes || 'Declined during interview evaluation.',

                          });

                        }}

                        disabled={busy}

                        title="Decline candidate and remove from interview panel"

                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-200 transition-all disabled:opacity-50"

                      >

                        <span className="text-rose-400 font-bold">✕</span>

                        <span>Decline & Remove</span>

                      </button>



                      <button

                        onClick={() => handleDeleteInvitation(currentInvite)}

                        title="Delete candidate interview"

                        className="p-2 rounded-xl text-white/30 hover:text-rose-400 hover:bg-rose-500/10 border border-[var(--line)] transition-colors"

                      >

                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />

                        </svg>

                      </button>

                    </div>

                  </div>



                  {/* Delivery Failed Notice Banner */}

                  {currentInvite.status === 'delivery_failed' && (

                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.08] p-3.5 flex items-start justify-between gap-3 text-xs">

                      <div className="flex items-start gap-2.5">

                        <span className="text-rose-400 font-bold text-sm mt-0.5">⚠️</span>

                        <div>

                          <p className="font-bold text-rose-200">Email delivery failed (SMTP not active in local dev)</p>

                          <p className="text-rose-300/70 text-[11px] mt-0.5">

                            Click <strong>Resend / Copy Link</strong> above to generate the direct candidate link, or copy it directly to test the candidate interview experience.

                          </p>

                        </div>

                      </div>

                    </div>

                  )}



                  {/* Live Booking Banner if booked */}

                  {currentInvite.interview && (

                    <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.08] p-4 flex flex-wrap items-center justify-between gap-3">

                      <div className="flex items-center gap-3">

                        <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center text-lg">

                          📹

                        </div>

                        <div>

                          <div className="text-xs font-bold text-sky-200 uppercase tracking-wider">

                            Live Video Interview Confirmed

                          </div>

                          <div className="text-sm font-semibold text-white mt-0.5">

                            {new Date(currentInvite.interview.starts_at).toLocaleString([], {

                              weekday: 'short',

                              month: 'short',

                              day: 'numeric',

                              hour: '2-digit',

                              minute: '2-digit',

                            })}

                            &nbsp;·&nbsp;{currentInvite.interview.duration_minutes} minutes

                          </div>

                        </div>

                      </div>



                      <a

                        href={currentInvite.interview.meeting_url}

                        target="_blank"

                        rel="noreferrer"

                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-sky-400 text-black hover:bg-sky-300 transition-colors shadow-sm"

                      >

                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />

                        </svg>

                        Join Meeting

                      </a>

                    </div>

                  )}

                </motion.div>



                {/* ── Written Questions & Responses Panel ── */}

                <motion.div variants={fadeInUpVariants} className="space-y-4">

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

                    <div>

                      <h3 className="text-base font-bold text-white flex items-center gap-2">

                        <span>Written Assessment Responses</span>

                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] border border-[var(--line)] text-white/60">

                          {Object.keys(currentAnswers).length} Answers

                        </span>

                      </h3>

                      <p className="text-xs text-white/40 mt-0.5">

                        Technical questions and candidate written answers submitted through the assessment portal.

                      </p>

                    </div>



                    {/* Question navigation tabs if multiple questions */}

                    {Object.keys(currentAnswers).length > 1 && (

                      <div className="flex items-center gap-1.5 flex-wrap">

                        <button

                          onClick={() => setActiveQuestionTab('all')}

                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${

                            activeQuestionTab === 'all'

                              ? 'bg-white text-black'

                              : 'bg-white/[0.04] text-white/50 hover:text-white border border-[var(--line)]'

                          }`}

                        >

                          View All

                        </button>

                        {Object.keys(currentAnswers).map((qId, idx) => (

                          <button

                            key={qId}

                            onClick={() => setActiveQuestionTab(qId)}

                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${

                              activeQuestionTab === qId

                                ? 'bg-[var(--accent)] text-[#04110f]'

                                : 'bg-white/[0.04] text-white/50 hover:text-white border border-[var(--line)]'

                            }`}

                          >

                            Q{idx + 1}

                          </button>

                        ))}

                      </div>

                    )}

                  </div>



                  {/* Empty responses state */}

                  {Object.keys(currentAnswers).length === 0 ? (

                    <div className="rounded-2xl border border-[var(--line)] bg-[#0e0e16] p-8 text-center space-y-3">

                      <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-[var(--line)] flex items-center justify-center mx-auto text-white/30 text-lg">

                        ⏳

                      </div>

                      <h4 className="text-sm font-bold text-white/80">Awaiting Candidate Submission</h4>

                      <p className="text-xs text-white/40 max-w-sm mx-auto">

                        This candidate has not yet submitted their written interview. Once submitted, their answers will appear here for your review and rating.

                      </p>

                    </div>

                  ) : (

                    /* Question cards list */

                    <div className="space-y-4">

                      {Object.entries(currentAnswers)

                        .filter(([qId]) => activeQuestionTab === 'all' || activeQuestionTab === qId)

                        .map(([qId, answer], idx) => {

                          // Find corresponding question prompt if available

                          const questionMeta = currentQuestions.find((q) => q.id === qId);

                          const prompt =

                            questionMeta?.prompt ||

                            `Technical Question ${idx + 1} (${questionMeta?.category || 'Role Skills'})`;

                          const category = questionMeta?.category || 'Technical Evaluation';

                          const wordCount = countWords(answer);



                          return (

                            <div

                              key={qId}

                              className="rounded-2xl border border-[var(--line)] overflow-hidden shadow-sm transition-all"

                              style={{ background: '#0e0e16' }}

                            >

                              {/* Question Prompt Header */}

                              <div className="px-6 py-4 border-b border-[var(--line)] bg-white/[0.02]">

                                <div className="flex items-center justify-between gap-2 mb-1.5">

                                  <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">

                                    Question {idx + 1} · {category}

                                  </span>

                                  <span className="text-[11px] font-mono text-white/40">

                                    {wordCount} words

                                  </span>

                                </div>

                                <h4 className="text-sm font-semibold text-white/95 leading-relaxed">

                                  {prompt}

                                </h4>

                              </div>



                              {/* Candidate Written Answer */}

                              <div className="p-6 space-y-3">

                                <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider flex items-center justify-between">

                                  <span>

                                    {questionMeta?.type === 'mcq'

                                      ? 'Multiple Choice Selection'

                                      : questionMeta?.type === 'coding'

                                      ? 'Candidate Solution Code'

                                      : 'Candidate Response'}

                                  </span>

                                  <button

                                    onClick={() => handleCopyLink(answer)}

                                    title="Copy response text"

                                    className="text-[11px] text-white/40 hover:text-[var(--accent)] transition-colors flex items-center gap-1"

                                  >

                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />

                                    </svg>

                                    <span>Copy</span>

                                  </button>

                                </div>



                                {questionMeta?.type === 'mcq' && questionMeta.options ? (

                                  <div className="space-y-2 pt-1">

                                    {questionMeta.options.map((opt, oIdx) => {

                                      const isChosen = answer === opt;

                                      const letter = String.fromCharCode(65 + oIdx);

                                      return (

                                        <div

                                          key={oIdx}

                                          className={`p-3 rounded-xl border text-xs sm:text-sm flex items-center justify-between ${

                                            isChosen

                                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-semibold'

                                              : 'bg-white/[0.02] border-white/10 text-white/60'

                                          }`}

                                        >

                                          <div className="flex items-center gap-2.5">

                                            <span

                                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${

                                                isChosen

                                                  ? 'bg-emerald-400 text-black'

                                                  : 'bg-white/10 text-white/50'

                                              }`}

                                            >

                                              {letter}

                                            </span>

                                            <span>{opt}</span>

                                          </div>

                                          {isChosen && (

                                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-400 text-black">

                                              Candidate Selected

                                            </span>

                                          )}

                                        </div>

                                      );

                                    })}

                                  </div>

                                ) : questionMeta?.type === 'coding' ? (

                                  <div className="p-4 rounded-xl border border-white/10 bg-[#050508] overflow-x-auto">

                                    <pre className="text-xs sm:text-sm font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed">

                                      {answer}

                                    </pre>

                                  </div>

                                ) : (

                                  <div className="p-4 rounded-xl border border-white/[0.06] bg-black/40 text-sm leading-relaxed text-white/85 whitespace-pre-wrap font-sans">

                                    {answer}

                                  </div>

                                )}

                              </div>

                            </div>

                          );

                        })}

                    </div>

                  )}

                </motion.div>



                {/* ── Recruiter Evaluation & Decision Scorecard Form ── */}

                <motion.div

                  variants={fadeInUpVariants}

                  className="rounded-2xl border border-[var(--line)] p-6 space-y-5"

                  style={{ background: '#0e0e16' }}

                >

                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">

                    <div>

                      <h3 className="text-base font-bold text-white flex items-center gap-2">

                        <span>Recruiter Scorecard & Decision</span>

                        {currentInvite.rating && (

                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">

                            Evaluated

                          </span>

                        )}

                      </h3>

                      <p className="text-xs text-white/40 mt-0.5">

                        Grade candidate technical competency and record the final hiring decision.

                      </p>

                    </div>



                    {currentInvite.decision && (

                      <span

                        className={`text-xs font-extrabold uppercase px-3 py-1 rounded-xl border ${

                          currentInvite.decision === 'advance'

                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'

                            : currentInvite.decision === 'decline'

                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'

                            : 'bg-amber-500/15 text-amber-200 border-amber-500/30'

                        }`}

                      >

                        Current Decision: {currentInvite.decision}

                      </span>

                    )}

                  </div>



                  {/* Rating control */}

                  <div>

                    <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">

                      Technical Competency Rating

                    </label>

                    <StarRating

                      value={currentDraft.rating}

                      onChange={(r) => setDraftField('rating', r)}

                      disabled={busy}

                    />

                  </div>



                  {/* Decision selection pills */}

                  <div>

                    <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">

                      Hiring Recommendation

                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">

                      {/* Advance / Hire */}

                      <button

                        type="button"

                        onClick={() => setDraftField('decision', 'advance')}

                        className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${

                          currentDraft.decision === 'advance'

                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/30'

                            : 'bg-white/[0.02] text-white/50 border-[var(--line)] hover:border-emerald-500/30 hover:text-emerald-300'

                        }`}

                      >

                        <span>✓</span>

                        <span>Advance / Hire</span>

                      </button>



                      {/* Hold / Need Second Opinion */}

                      <button

                        type="button"

                        onClick={() => setDraftField('decision', 'hold')}

                        className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${

                          currentDraft.decision === 'hold'

                            ? 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'

                            : 'bg-white/[0.02] text-white/50 border-[var(--line)] hover:border-amber-500/30 hover:text-amber-300'

                        }`}

                      >

                        <span>⏸</span>

                        <span>Hold / Review</span>

                      </button>



                      {/* Decline */}

                      <button

                        type="button"

                        onClick={() => setDraftField('decision', 'decline')}

                        className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${

                          currentDraft.decision === 'decline'

                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md shadow-rose-500/10 ring-1 ring-rose-500/30'

                            : 'bg-white/[0.02] text-white/50 border-[var(--line)] hover:border-rose-500/30 hover:text-rose-300'

                        }`}

                      >

                        <span>✕</span>

                        <span>Decline Candidate</span>

                      </button>

                    </div>

                  </div>



                  {/* Recruiter Notes */}

                  <div>

                    <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">

                      Evaluation Notes & Comments

                    </label>

                    <textarea

                      rows={3}

                      value={currentDraft.notes}

                      onChange={(e) => setDraftField('notes', e.target.value)}

                      placeholder="Add observations about code structure, communication depth, red flags, or specific feedback for hiring managers..."

                      className="w-full rounded-xl border border-[var(--line)] bg-white/[0.04] p-3 text-xs text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/50 transition-colors"

                    />

                  </div>



                  {/* Submit evaluation */}

                  <div className="flex items-center justify-end gap-3 pt-2">

                    <button

                      type="button"

                      disabled={busy}

                      onClick={() => handleSaveReview(currentInvite)}

                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${

                        currentDraft.decision === 'decline'

                          ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'

                          : currentDraft.decision === 'advance'

                          ? 'bg-emerald-400 hover:bg-emerald-300 text-black shadow-emerald-500/20'

                          : 'bg-[var(--accent)] hover:brightness-110 text-[#04110f] shadow-[var(--accent)]/15'

                      } disabled:opacity-50`}

                    >

                      {busy && (

                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />

                      )}

                      <span>

                        {currentDraft.decision === 'decline'

                          ? '✕ Decline & Remove Candidate'

                          : currentDraft.decision === 'advance'

                          ? '✓ Advance Candidate & Save'

                          : 'Save Scorecard & Evaluation'}

                      </span>

                    </button>

                  </div>

                </motion.div>

              </motion.div>

            )}

          </main>

        </div>

      </div>

    </div>

  );

}

