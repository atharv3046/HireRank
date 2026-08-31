import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useState } from 'react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleDemo = async () => {
    setLoading(true);
    try {
      const data = await api.demoLogin();
      login(data.access_token, { id: data.user_id, email: data.email, role: data.role });
      navigate('/dashboard');
    } catch {
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* NAV */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <span className="font-semibold text-gray-900 text-lg">HireRank</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
          <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
          <a href="#how" className="hover:text-gray-900 transition-colors">How it works</a>
          <a href="#accuracy" className="hover:text-gray-900 transition-colors">Accuracy</a>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 transition-colors">
            Sign In
          </button>
          <button onClick={() => navigate('/signup')} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            Get Started
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-8 pt-20 pb-16 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            AI-powered hiring platform
          </div>
          <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
            Rank every applicant against the role <span className="text-indigo-600">in minutes</span>
          </h1>
          <p className="text-lg text-gray-500 mb-8 leading-relaxed">
            Parse resumes instantly, embed them against job descriptions, and get explainable ranked shortlists. Reduce screening time by 80% while improving candidate quality.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDemo}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-60"
            >
              {loading ? 'Loading...' : '⚡ Try Live Demo'}
            </button>
            <button onClick={() => navigate('/dashboard')} className="border border-gray-200 hover:border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors">
              Open dashboard →
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">No credit card required · Demo pre-loaded with sample data</p>
        </div>

        {/* HERO CARD MOCKUP */}
        <div className="hidden md:block">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-5 max-w-sm ml-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">ACTIVE POSTING</div>
                <div className="font-semibold text-gray-900">Senior Python Engineer</div>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Screening</span>
            </div>
            {[
              { name: 'Sarah Jenkins', skills: 'Python, FastAPI', exp: '8 YOE', score: 94, color: 'bg-green-500' },
              { name: 'David Chen', skills: 'Django, AWS', exp: '6 YOE', score: 88, color: 'bg-green-400' },
              { name: 'Aisha Rahman', skills: 'Python, Docker', exp: '5 YOE', score: 76, color: 'bg-yellow-400' },
            ].map((c, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-t border-gray-50">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">
                  {c.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                  <div className="text-xs text-gray-400">{c.skills} · {c.exp}</div>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${c.color}`}></div>
                  <span className="text-sm font-bold text-gray-900">{c.score}</span>
                </div>
              </div>
            ))}
            <div className="mt-3 text-xs text-gray-400 text-center">24 more candidates in queue</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Intelligent Screening Infrastructure</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Built for precision. Designed for speed. Everything you need to evaluate talent at scale without losing the human context.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '📄',
                title: 'Parse any resume',
                desc: 'Seamlessly extract structured data from PDF and DOCX files. Our NLP pipeline instantly structures unstructured experience into actionable data points.',
                tags: ['PDF', 'DOCX'],
              },
              {
                icon: '📊',
                title: 'Explainable 0–100 scores',
                desc: 'Semantic fit, skills, experience, and education weighted into one transparent score. See exactly which attributes drove the evaluation.',
                tags: ['Semantic 50%', 'Skills 25%'],
              },
              {
                icon: '🏆',
                title: 'Ranked shortlists',
                desc: 'Instantly sort and filter massive applicant pools per job posting. Surface top candidates automatically, so your team can focus on interviews.',
                tags: ['Auto-ranked', 'Filterable'],
              },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{f.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {f.tags.map(t => (
                    <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 max-w-7xl mx-auto px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">How it works</h2>
          <p className="text-gray-500">Four steps from resume upload to ranked shortlist</p>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            { step: '01', title: 'Upload Resumes', desc: 'Drop PDF or DOCX files onto any job posting. Bulk or single upload.' },
            { step: '02', title: 'AI Extraction', desc: 'spaCy NER extracts name, contact, skills, experience years, and education level.' },
            { step: '03', title: 'Semantic Embedding', desc: 'Sentence-Transformers generate 384-dim vectors capturing contextual meaning.' },
            { step: '04', title: 'Ranked Results', desc: 'Candidates ranked 0–100 with full score breakdowns and matched/missing skills.' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-sm mx-auto mb-4">{s.step}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ACCURACY */}
      <section id="accuracy" className="bg-indigo-600 py-20">
        <div className="max-w-5xl mx-auto px-8 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="w-24 h-24 bg-indigo-500 rounded-full flex items-center justify-center mx-auto md:mx-0 mb-6">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">Semantic accuracy, not keyword matching</h2>
            <p className="text-indigo-200 mb-6 leading-relaxed">Our embedding models understand the semantic relationship between a candidate's trajectory and your role requirements. We don't just match keywords — we understand context.</p>
            {[
              'Alias normalization: K8s → Kubernetes, ReactJS → React',
              'Overlapping experience intervals merged correctly',
              'Education level ordinal scoring (PhD > Masters > Bachelors)',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 mb-3">
                <div className="w-5 h-5 bg-indigo-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-indigo-100 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to hire smarter?</h2>
        <p className="text-gray-500 mb-8">Try the live demo — no signup required. Pre-loaded with a sample job and candidates.</p>
        <button
          onClick={handleDemo}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-lg font-medium text-lg transition-colors disabled:opacity-60 inline-flex items-center gap-2"
        >
          {loading ? 'Loading...' : '⚡ Start screening →'}
        </button>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-8 px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <span className="text-sm font-medium text-gray-700">HireRank</span>
        </div>
        <div className="flex gap-6 text-xs text-gray-400">
          <a href="#" className="hover:text-gray-600">Privacy Policy</a>
          <a href="#" className="hover:text-gray-600">Terms of Service</a>
          <a href="https://github.com/atharv3046/HireRank" target="_blank" rel="noreferrer" className="hover:text-gray-600">GitHub</a>
        </div>
        <span className="text-xs text-gray-400">© 2024 HireRank. AI Precision Hiring.</span>
      </footer>
    </div>
  );
}
