import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, CandidateInterviewRead } from '../api/client';

export default function CandidateInterviewPage() {
  const { token = '' } = useParams();
  const [interview, setInterview] = useState<CandidateInterviewRead | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getCandidateInterview(token);
      setInterview(data);
      if (data.answers) setAnswers(data.answers);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'This interview link is invalid or expired. Contact the hiring team for help.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [token]);

  useEffect(() => {
    if (!interview || interview.status === 'completed' || interview.status === 'booked' || !Object.values(answers).some((answer) => answer.trim())) return;
    const timer = window.setTimeout(() => {
      api.saveCandidateInterviewDraft(token, answers).then(() => setMessage('Your draft is saved automatically.')).catch(() => {});
    }, 800);
    return () => window.clearTimeout(timer);
  }, [answers, interview?.status, token]);

  const completed = interview?.status === 'completed' || interview?.status === 'booked';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interview) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.submitCandidateInterview(token, answers);
      setMessage(result.message);
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not submit your responses. Please try again.');
    } finally { setSubmitting(false); }
  };

  const book = async (slotId: number) => {
    setBookingId(slotId);
    setError('');
    try {
      const result = await api.bookCandidateInterview(token, slotId);
      setMessage(result.email_sent ? 'Your meeting time is confirmed. We sent the details by email.' : 'Your meeting time is booked. Use the recruiter meeting link below at your scheduled time.');
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'That time is no longer available. Refresh and choose another slot.');
      await refresh();
    } finally { setBookingId(null); }
  };

  if (loading) return <main className="min-h-screen bg-[#08090c] text-white grid place-items-center"><p className="text-white/60">Loading your interview…</p></main>;
  if (error && !interview) return <main className="min-h-screen bg-[#08090c] text-white grid place-items-center p-6"><div className="max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center"><h1 className="text-2xl font-bold">Interview link unavailable</h1><p className="mt-3 text-white/60">{error}</p></div></main>;
  if (!interview) return null;

  return (
    <main className="min-h-screen bg-[#08090c] text-white px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 border-b border-white/10 pb-6">
          <div className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">{interview.company_name}</div>
          <h1 className="mt-2 text-3xl font-bold">{interview.assessment_title}</h1>
          <p className="mt-2 text-sm text-white/55">{interview.candidate_name ? `Hello ${interview.candidate_name}. ` : ''}Written interview · about {interview.duration_minutes} minutes</p>
          <p className="mt-1 text-xs text-white/40">Your responses are shared with the recruiting team for this role.</p>
        </header>

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        {message && <div role="status" className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div>}

        <form onSubmit={submit} className="space-y-6">
          {interview.questions.map((question, index) => {
            const isMCQ = question.type === 'mcq' || (question.options && question.options.length > 0);
            const isCoding = question.type === 'coding';
            const currentAnswer = answers[question.id] || '';

            return (
              <section key={question.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7 space-y-4">
                {/* Category & Step Header */}
                <div className="flex items-center justify-between gap-4 text-[11px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--accent)]">{question.category}</span>
                    {isMCQ && (
                      <span className="bg-purple-500/10 text-purple-300 border border-purple-500/25 px-2 py-0.5 rounded-md text-[10px] font-extrabold">
                        Multiple Choice
                      </span>
                    )}
                    {isCoding && (
                      <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 px-2 py-0.5 rounded-md text-[10px] font-extrabold">
                        Coding Challenge
                      </span>
                    )}
                  </div>
                  <span className="text-white/40">{index + 1} / {interview.questions.length}</span>
                </div>

                {/* Question Title if present */}
                {question.title && (
                  <h3 className="text-lg font-bold text-white tracking-tight">{question.title}</h3>
                )}

                {/* Question Prompt */}
                <div className="text-sm sm:text-base font-medium leading-relaxed text-white/90 whitespace-pre-wrap">
                  {question.prompt}
                </div>

                {/* ── MCQ Option Selector ── */}
                {isMCQ ? (
                  completed ? (
                    <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] text-sm">
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                        Your Selected Answer:
                      </span>
                      <span className="text-white font-semibold">{currentAnswer || 'No option selected.'}</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5 pt-2">
                      <input
                        type="hidden"
                        required
                        value={currentAnswer}
                      />
                      {(question.options || []).map((option, optIdx) => {
                        const isSelected = currentAnswer === option;
                        const letter = String.fromCharCode(65 + optIdx);
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
                            className={`w-full text-left p-4 rounded-xl border text-sm flex items-start gap-3.5 transition-all ${
                              isSelected
                                ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/10 ring-1 ring-[var(--accent)]/40'
                                : 'bg-black/30 border-white/10 text-white/80 hover:bg-white/[0.04] hover:border-white/20'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                isSelected
                                  ? 'bg-[var(--accent)] text-[#04110f]'
                                  : 'bg-white/10 text-white/60'
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="flex-1 leading-snug">{option}</span>
                            {isSelected && (
                              <span className="text-[var(--accent)] font-bold text-sm ml-auto">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : isCoding ? (
                  /* ── DSA Code Solution Editor ── */
                  completed ? (
                    <div className="rounded-xl border border-white/10 bg-[#050508] p-4 overflow-x-auto">
                      <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold mb-2">
                        Submitted Solution Code:
                      </div>
                      <pre className="text-xs sm:text-sm font-mono text-emerald-200 whitespace-pre-wrap leading-relaxed">
                        {currentAnswer || '# No code submitted.'}
                      </pre>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-white/40">
                        <span>Solution Code (Python / Language of Choice)</span>
                        {question.starter_code && !currentAnswer && (
                          <button
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: question.starter_code || '' }))}
                            className="text-[var(--accent)] hover:underline font-semibold"
                          >
                            Insert starter template ↵
                          </button>
                        )}
                      </div>
                      <textarea
                        required
                        rows={10}
                        value={currentAnswer || question.starter_code || ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                        placeholder="# Write your optimal solution here..."
                        className="w-full rounded-xl border border-white/10 bg-[#050508] p-4 text-xs sm:text-sm font-mono leading-relaxed text-emerald-300 placeholder:text-white/20 focus:border-[var(--accent)] focus:outline-none resize-y"
                      />
                    </div>
                  )
                ) : (
                  /* ── Open Ended Text / System Design ── */
                  completed ? (
                    <p className="whitespace-pre-wrap rounded-xl border border-white/5 bg-black/30 p-4 text-sm leading-relaxed text-white/80">
                      {currentAnswer || 'No response provided.'}
                    </p>
                  ) : (
                    <textarea
                      required
                      minLength={10}
                      maxLength={10000}
                      rows={6}
                      value={currentAnswer}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                      placeholder="Write your explanation or design..."
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/40 p-4 text-sm leading-relaxed text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                    />
                  )
                )}
              </section>
            );
          })}
          {!completed && (
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[var(--accent)] px-5 py-3.5 font-bold text-[#04110f] hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-[var(--accent)]/15 text-sm"
            >
              {submitting ? 'Submitting Responses…' : 'Submit Interview Responses'}
            </button>
          )}
        </form>

        {completed && !interview.booked_interview && (
          <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <h2 className="text-xl font-bold">Select an Interview Meeting Time</h2>
              <p className="text-xs text-slate-400 mt-1">Select an available discussion slot below to meet with the team via their video link (Google Meet / Zoom).</p>
            <p className="mt-1 text-sm text-white/55">Choose one of the available times. Times are shown in your local timezone.</p>
            {interview.available_slots.length === 0 ? (
              <div className="mt-5 rounded-xl border border-white/5 bg-black/30 p-4 text-sm text-white/60">There are no times available yet. The recruiting team will add slots; refresh this page later to book.<button type="button" onClick={refresh} className="ml-2 font-semibold text-[var(--accent)] underline">Refresh times</button></div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">{interview.available_slots.map((slot) => <button key={slot.id} onClick={() => book(slot.id)} disabled={bookingId !== null} className="rounded-xl border border-white/10 bg-black/30 p-4 text-left transition hover:border-[var(--accent)] disabled:opacity-50"><span className="block font-semibold">{new Date(slot.starts_at).toLocaleString()}</span><span className="mt-1 block text-xs text-white/45">{slot.duration_minutes} minutes</span><span className="mt-3 block text-xs text-[var(--accent)]">{bookingId === slot.id ? 'Booking…' : 'Book this time →'}</span></button>)}</div>
            )}
          </section>
        )}

        {interview.booked_interview && (
          <section className="mt-10 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-6">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">Interview meeting confirmed</div>
            <h2 className="mt-2 text-lg font-bold">{new Date(interview.booked_interview.starts_at).toLocaleString()}</h2>
            <p className="mt-1 text-sm text-white/55">{interview.booked_interview.duration_minutes} minutes</p>
            <a href={interview.booked_interview.meeting_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-xl bg-emerald-400 px-5 py-3 font-bold text-black">Open Video Meeting Link</a>
          </section>
        )}
        <footer className="mt-10 text-center text-xs text-white/30">If you have trouble with this interview, reply to the invitation email to contact the recruiter.</footer>
      </div>
    </main>
  );
}
