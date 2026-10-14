import React, { useState, useEffect } from 'react';
import { api, RejectionTemplateResponse } from '../api/client';

interface RejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: number;
  candidateName?: string;
  candidateEmail?: string;
  onSuccess?: (candidateId: number) => void;
}

export const RejectionModal: React.FC<RejectionModalProps> = ({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  candidateEmail,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<RejectionTemplateResponse | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setStatusMessage(null);

    api
      .getRejectionTemplate(candidateId)
      .then((data) => {
        if (!isMounted) return;
        setTemplate(data);
        setSubject(data.subject);
        setBody(data.body);
      })
      .catch((err) => {
        if (!isMounted) return;
        setStatusMessage({
          type: 'error',
          text: err.response?.data?.detail || 'Failed to generate rejection template.',
        });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, candidateId]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const textToCopy = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleSend = async () => {
    try {
      setSending(true);
      setStatusMessage(null);

      const res = await api.sendRejection(candidateId, {
        subject,
        body,
        mark_no_hire: true,
      });

      setStatusMessage({
        type: 'success',
        text: res.message || 'Candidate marked as No Hire and rejection logged.',
      });

      if (onSuccess) {
        onSuccess(candidateId);
      }

      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to send rejection email.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0f0f17] border border-white/[0.1] shadow-2xl p-6 sm:p-7 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-xl shadow-sm">
              ✉️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Anti-Ghosting Rejection Composer
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Feature 8
                </span>
              </div>
              <p className="text-xs text-white/40 mt-0.5">
                Personalized, constructive rejection derived from scoring data without legal exposure.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white flex items-center justify-center text-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-white/50">Composing constructive feedback from scoring criteria...</p>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <div className="mt-5 space-y-4">
            {/* Status Feedback Alert */}
            {statusMessage && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                }`}
              >
                <span>{statusMessage.type === 'success' ? '✓' : '⚠️'}</span>
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Candidate & Compliance Bar */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-white/40">Recipient: </span>
                <span className="font-bold text-white">
                  {candidateName || template?.candidate_name || 'Candidate'}
                </span>
                <span className="text-white/40 mx-1.5">•</span>
                <span className="text-white/60">
                  {candidateEmail || template?.candidate_email || 'No email on file'}
                </span>
              </div>

              {/* Compliance Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-semibold text-[11px] self-start sm:self-auto">
                <span>🛡️</span>
                <span>{template?.compliance_badge || '✓ Safe: References only skills & experience criteria'}</span>
              </div>
            </div>

            {/* Data Attribution Pill Box */}
            {template && (
              <div className="flex flex-wrap gap-2 text-xs">
                {template.referenced_strengths && template.referenced_strengths.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    <span className="font-bold">Recognized:</span>
                    <span>{template.referenced_strengths.join(', ')}</span>
                  </div>
                )}
                {template.referenced_gaps && template.referenced_gaps.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    <span className="font-bold">Primary Gap:</span>
                    <span>{template.referenced_gaps.join(', ')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Subject Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/60">
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.1] text-white text-xs focus:outline-none focus:border-rose-500/50"
              />
            </div>

            {/* Body Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white/60">
                  Email Body (Editable)
                </label>
                <span className="text-[11px] text-white/30">
                  Feel free to customize before sending
                </span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={9}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.1] text-white/90 text-xs leading-relaxed font-sans focus:outline-none focus:border-rose-500/50 resize-y"
              />
            </div>

            {/* Recruiter Legal Disclaimer */}
            <div className="p-3 rounded-xl bg-white/[0.015] border border-white/[0.04] text-[11px] text-white/40 leading-relaxed">
              <span className="font-semibold text-white/60">Recruiter Notice: </span>
              {template?.recruiter_disclaimer ||
                'Preview and edit before sending. You are responsible for compliance with applicable employment communications laws.'}
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.06]">
              {/* Secondary Actions: Copy & Mailto */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white border border-white/[0.1] transition-all flex items-center justify-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <span className="text-emerald-400">✓</span>
                      <span className="text-emerald-300">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <span>📋</span>
                      <span>Copy to Clipboard</span>
                    </>
                  )}
                </button>

                {template?.mailto_link && (
                  <a
                    href={template.mailto_link}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white border border-white/[0.1] transition-all flex items-center justify-center gap-1.5"
                    title="Open draft in default desktop email app"
                  >
                    <span>📬</span>
                    <span>Open in Email App</span>
                  </a>
                )}
              </div>

              {/* Primary Send Button */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-white/40 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !body.trim()}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-400 hover:to-amber-500 text-white shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending & Updating...</span>
                    </>
                  ) : (
                    <>
                      <span>📤</span>
                      <span>Send & Mark No Hire</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
