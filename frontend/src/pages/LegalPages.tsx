import { Link } from "react-router-dom";

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-white">
      <nav className="border-b border-[var(--line)] px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-bold text-xs">HR</div><span className="font-bold text-lg tracking-tight text-[var(--text)] font-sans">Hire<span className="text-[var(--accent)]">Rank</span></span></Link>
        <Link to="/" className="text-sm text-white/50 hover:text-white transition-colors">? Back to Home</Link>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-black text-white mb-2">{title}</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: October 1, 2026</p>
        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-white/70 leading-relaxed">
          {children}
        </div>
      </div>
      <footer className="border-t border-[var(--line)] px-6 py-6 text-center text-white/30 text-xs">
        © {new Date().getFullYear()} HireRank. All rights reserved.
      </footer>
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <h2 className="text-lg font-bold text-white mb-2">1. Information We Collect</h2>
        <p>We collect information you provide directly, including name, email address, and resume data uploaded through our platform. We also collect usage data such as pages visited and features used.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">2. How We Use Your Information</h2>
        <p>We use collected data to operate and improve HireRank, process resume screenings, send transactional emails, and comply with legal obligations. We do not sell your personal data to third parties.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">3. Data Storage & Security</h2>
        <p>Your data is stored securely using industry-standard encryption. Resume files are stored in a private upload directory. API keys and secrets are never exposed in frontend code.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">4. Candidate Data & Bias Mitigation</h2>
        <p>HireRank's Blind Screening feature masks names, contact details, institution prestige, and graduation years by default to reduce unconscious bias. Candidate data is used solely for the purpose of resume screening requested by the recruiter.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">5. Data Retention</h2>
        <p>Resume and candidate data is retained for the duration of the recruiter's account. You may request deletion of your data at any time by contacting support.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">6. Your Rights</h2>
        <p>You have the right to access, correct, or delete your personal data. To exercise these rights, please contact us at privacy@hirerank.app.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">7. Contact</h2>
        <p>For privacy-related inquiries, email us at <a href="mailto:privacy@hirerank.app" className="text-[var(--accent)] hover:underline">privacy@hirerank.app</a>.</p>
      </section>
    </LegalPage>
  );
}

export function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service">
      <section>
        <h2 className="text-lg font-bold text-white mb-2">1. Acceptance of Terms</h2>
        <p>By accessing or using HireRank, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">2. Use of the Service</h2>
        <p>HireRank is intended for use by recruiters and HR professionals for the purpose of candidate screening. You agree not to use the platform for any unlawful purpose, to discriminate against candidates based on protected characteristics, or to upload malicious content.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">3. AI-Generated Content</h2>
        <p>HireRank uses AI to generate resume scores and interview questions. These are decision-support tools only. Final hiring decisions remain the sole responsibility of the recruiter. AI outputs should be reviewed critically and must not be used as the sole basis for hiring decisions.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">4. NYC Local Law 144 Compliance</h2>
        <p>HireRank provides tools to support compliance with NYC Local Law 144 (Automated Employment Decision Tools). Recruiters remain solely responsible for ensuring their use of the platform meets all applicable legal requirements.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">5. Account Security</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials. Notify us immediately of any unauthorized access at support@hirerank.app.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">6. Limitation of Liability</h2>
        <p>HireRank is provided "as is" without warranty of any kind. We are not liable for hiring outcomes, data loss, or indirect damages resulting from use of the platform.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">7. Changes to Terms</h2>
        <p>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the revised terms.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-white mb-2">8. Contact</h2>
        <p>For legal inquiries: <a href="mailto:legal@hirerank.app" className="text-[var(--accent)] hover:underline">legal@hirerank.app</a></p>
      </section>
    </LegalPage>
  );
}
