import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bookmark,
  BarChart2,
  FileText,
  TrendingUp,
  Menu,
  X as XIcon,
  ChevronDown,
} from 'lucide-react'

// ─── FAQ Data ──────────────────────────────────────────────────────────────────
const faqs = [
  {
    q: 'How does the Talvyn Chrome Extension work?',
    a: 'The extension sits quietly in your browser and automatically detects job opportunities on LinkedIn, Indeed, Unstop, Greenhouse, Lever, and company career pages. With one click, it extracts job requirements, computes your readiness score, and saves or auto-fills the application.',
  },
  {
    q: 'Can Talvyn auto-fill application forms safely?',
    a: 'Yes! Talvyn matches fields like your legal name, contact information, work history, and portfolio links directly from your verified profile. Sensitive questions are always presented for your explicit review first.',
  },
  {
    q: 'Which job boards and ATS platforms are supported?',
    a: 'Talvyn features universal job detection that works on almost any web career page, with dedicated adapters optimized for LinkedIn, Indeed, Unstop, Greenhouse, Lever, Workday, Ashby, and SmartRecruiters.',
  },
  {
    q: 'Is my candidate data kept private and secure?',
    a: 'Absolutely. Your resume data, profile details, and applications belong entirely to you. We never sell your personal data or share your pipeline with third parties.',
  },
]

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [faqModalOpen, setFaqModalOpen] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-[#06070D] text-[#F3F4F8] font-sans antialiased selection:bg-[#5054EA]/40 selection:text-white overflow-x-hidden relative flex flex-col justify-between">
      {/* ─── AMBIENT BACKGROUND GLOWS ─── */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Top subtle cosmic glow */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(80,84,234,0.14),rgba(124,58,237,0.06),transparent_70%)] blur-[120px]" />
        {/* Center subtle glow */}
        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_70%)] blur-[100px]" />
        {/* Bottom wave ambient glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1100px] h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(80,84,234,0.12),rgba(99,102,241,0.04),transparent_70%)] blur-[120px]" />
      </div>

      {/* ─── TOP NAVBAR ─── */}
      <header className="w-full z-50 bg-[#06070D]/80 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group focus:outline-none">
            <img
              src="/logo-talvyn.png"
              alt="Talvyn"
              className="w-8 h-8 object-contain drop-shadow-[0_0_14px_rgba(80,84,234,0.45)] transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-slate-100 transition-colors">
              Talvyn
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors duration-150">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors duration-150">
              How It Works
            </a>
            <button
              type="button"
              onClick={() => setFaqModalOpen(true)}
              className="hover:text-white transition-colors duration-150 focus:outline-none"
            >
              FAQ
            </button>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors duration-150"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="bg-[#5054EA] hover:bg-[#4347D4] text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(80,84,234,0.35)] hover:shadow-[0_0_26px_rgba(80,84,234,0.55)] transition-all duration-200"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <XIcon className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden px-6 py-5 bg-[#06070D]/95 border-b border-white/[0.08] backdrop-blur-xl flex flex-col gap-4">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="text-slate-300 hover:text-white font-medium text-sm py-1"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="text-slate-300 hover:text-white font-medium text-sm py-1"
            >
              How It Works
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                setFaqModalOpen(true)
              }}
              className="text-left text-slate-300 hover:text-white font-medium text-sm py-1 focus:outline-none"
            >
              FAQ
            </button>
            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
              <Link
                to="/login"
                className="text-sm font-medium text-slate-300 hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="bg-[#5054EA] hover:bg-[#4347D4] text-white text-xs font-medium px-4 py-2 rounded-full"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1">
        {/* ─── HERO SECTION ─── */}
        <section className="pt-4 md:pt-6 pb-2 text-center px-6 max-w-5xl mx-auto flex flex-col items-center">
          {/* Eyebrow */}
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-[#8B8DF8] mb-3">
            A SMARTER WAY TO YOUR NEXT OPPORTUNITY
          </p>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[76px] font-bold tracking-tight text-white leading-[1.08] mb-3">
            From Potential <br />
            <span className="text-[#8B8DF8]">to Offer.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-slate-400 text-sm sm:text-base md:text-lg font-normal leading-relaxed max-w-2xl mx-auto mb-5">
            Talvyn helps you save jobs, track applications, and stay organized —
            <br className="hidden sm:inline" />
            so you can focus on what really matters: landing the role you deserve.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-6">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-[#5054EA] hover:bg-[#4347D4] text-white text-sm md:text-base font-medium px-7 py-3 rounded-full shadow-[0_0_24px_rgba(80,84,234,0.4)] hover:shadow-[0_0_32px_rgba(80,84,234,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/login"
              className="text-sm md:text-base font-medium text-slate-300 hover:text-white transition-colors duration-150"
            >
              Sign In
            </Link>
          </div>
        </section>

        {/* ─── CELESTIAL HORIZON ARC ─── */}
        <section className="relative w-full overflow-hidden pt-6 sm:pt-8 md:pt-12 pb-4 md:pb-6 flex flex-col items-center">
          {/* Large Arc Canvas SVG */}
          <div className="w-full max-w-[1600px] h-[90px] sm:h-[110px] md:h-[130px] relative pointer-events-none">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 1440 130"
              fill="none"
              preserveAspectRatio="none"
            >
              <defs>
                {/* Arc Line Gradient */}
                <linearGradient id="horizonGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#5054EA" stopOpacity="0" />
                  <stop offset="25%" stopColor="#6366F1" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#A5B4FC" stopOpacity="0.95" />
                  <stop offset="75%" stopColor="#818CF8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#5054EA" stopOpacity="0" />
                </linearGradient>

                {/* Ambient Blur Filter */}
                <filter id="arcBlur" x="-10%" y="-30%" width="120%" height="160%">
                  <feGaussianBlur stdDeviation="8" />
                </filter>
              </defs>

              {/* Faint ambient atmospheric glow line */}
              <path
                d="M -100,130 Q 720,10 1540,130"
                stroke="#6366F1"
                strokeWidth="7"
                strokeOpacity="0.25"
                filter="url(#arcBlur)"
              />

              {/* Crisp illuminated celestial arc */}
              <path
                d="M -100,130 Q 720,10 1540,130"
                stroke="url(#horizonGlow)"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </section>

        {/* ─── SECTION 2: A FOCUSED TOOLKIT ─── */}
        <section id="features" className="pt-16 sm:pt-20 md:pt-28 pb-14 md:pb-20 px-6 max-w-6xl mx-auto text-center">
          {/* Eyebrow */}
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-[#8B8DF8] mb-3">
            EVERYTHING YOU NEED
          </p>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            A focused toolkit for <br className="sm:hidden" />
            <span className="text-[#8B8DF8]">your career journey</span>
          </h2>

          {/* Subtitle */}
          <p className="text-slate-400 text-sm sm:text-base font-normal max-w-lg mx-auto mb-8 md:mb-10">
            Powerful tools, seamlessly connected — all in one place.
          </p>

          {/* 4 Feature Columns with subtle vertical dividers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-10 lg:gap-y-0 text-left relative divide-y sm:divide-y-0 lg:divide-x divide-white/[0.08]">
            {/* Column 1: Save Jobs */}
            <div className="px-6 py-2 flex flex-col items-start">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#101222] border border-white/[0.08] mb-6 text-[#8B8DF8]">
                <Bookmark className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">Save Jobs</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Keep opportunities from anywhere.
              </p>
            </div>

            {/* Column 2: Track Applications */}
            <div className="px-6 py-2 pt-8 sm:pt-2 flex flex-col items-start">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#101222] border border-white/[0.08] mb-6 text-[#8B8DF8]">
                <BarChart2 className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">Track Applications</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Know exactly where you stand.
              </p>
            </div>

            {/* Column 3: Auto-Fill Applications */}
            <div className="px-6 py-2 pt-8 lg:pt-2 flex flex-col items-start">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#101222] border border-white/[0.08] mb-6 text-[#8B8DF8]">
                <FileText className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">Auto-Fill Applications</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Apply faster with fewer mistakes.
              </p>
            </div>

            {/* Column 4: Stay Organized */}
            <div className="px-6 py-2 pt-8 lg:pt-2 flex flex-col items-start">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#101222] border border-white/[0.08] mb-6 text-[#8B8DF8]">
                <TrendingUp className="w-5 h-5 stroke-[1.8]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">Stay Organized</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Notes, reminders, and more.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION: HOW IT WORKS ─── */}
        <section id="how-it-works" className="pt-16 sm:pt-20 md:pt-24 pb-20 md:pb-28 px-6 max-w-6xl mx-auto text-center relative">
          {/* Eyebrow */}
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-[#8B8DF8] mb-3">
            HOW IT WORKS
          </p>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Less chaos. <br className="sm:hidden" />
            <span className="text-[#8B8DF8]">More progress.</span>
          </h2>

          {/* Subtitle */}
          <p className="text-slate-400 text-sm sm:text-base font-normal max-w-lg mx-auto mb-14">
            Talvyn guides your job hunt from bookmark to offer in four intuitive steps.
          </p>

          {/* 4 Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {/* Step 1 */}
            <div className="bg-[#0C0D1A] border border-white/[0.08] rounded-2xl p-6 relative group hover:border-[#8B8DF8]/40 transition-all duration-200">
              <div className="text-3xl font-black text-[#8B8DF8]/40 group-hover:text-[#8B8DF8]/80 transition-colors mb-4">
                01
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Save with One Click</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Save jobs from LinkedIn, Indeed, company career pages, or any job board directly into your personal workspace.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#0C0D1A] border border-white/[0.08] rounded-2xl p-6 relative group hover:border-[#8B8DF8]/40 transition-all duration-200">
              <div className="text-3xl font-black text-[#8B8DF8]/40 group-hover:text-[#8B8DF8]/80 transition-colors mb-4">
                02
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Readiness Scoring</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Analyze job requirements against your verified profile to calculate your real match score before applying.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#0C0D1A] border border-white/[0.08] rounded-2xl p-6 relative group hover:border-[#8B8DF8]/40 transition-all duration-200">
              <div className="text-3xl font-black text-[#8B8DF8]/40 group-hover:text-[#8B8DF8]/80 transition-colors mb-4">
                03
              </div>
              <h3 className="text-base font-semibold text-white mb-2">1-Click Auto-Fill</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Autofill job applications in seconds without repetitive copy-pasting. Sensitive questions stay in your control.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-[#0C0D1A] border border-white/[0.08] rounded-2xl p-6 relative group hover:border-[#8B8DF8]/40 transition-all duration-200">
              <div className="text-3xl font-black text-[#8B8DF8]/40 group-hover:text-[#8B8DF8]/80 transition-colors mb-4">
                04
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Track to the Offer</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Stay on top of deadlines, interview dates, follow-ups, and offers with an automated pipeline board.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* ─── FOOTER ─── */}
      <footer className="w-full border-t border-white/[0.08] bg-[#06070D]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group focus:outline-none">
            <img
              src="/logo-talvyn.png"
              alt="Talvyn"
              className="w-7 h-7 object-contain drop-shadow-[0_0_12px_rgba(80,84,234,0.45)] transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-slate-100 transition-colors">
              Talvyn
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex flex-wrap items-center justify-center gap-8 text-sm font-normal text-slate-400">
            <a href="#features" className="hover:text-white transition-colors duration-150">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors duration-150">
              How It Works
            </a>
            <button
              type="button"
              onClick={() => setFaqModalOpen(true)}
              className="hover:text-white transition-colors duration-150 focus:outline-none"
            >
              FAQ
            </button>
          </nav>
        </div>
      </footer>

      {/* ─── INTERACTIVE FAQ MODAL ─── */}
      {faqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-xl bg-[#0C0D1A] border border-white/[0.1] rounded-2xl p-6 sm:p-8 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-6">
              <h3 className="text-xl font-bold text-white tracking-tight">Frequently Asked Questions</h3>
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg focus:outline-none"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx
                return (
                  <div
                    key={idx}
                    className="border border-white/[0.06] rounded-xl overflow-hidden bg-white/[0.02]"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-medium text-white hover:text-[#8B8DF8] transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#8B8DF8]' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-white/[0.04] pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-8 pt-4 border-t border-white/[0.06] flex justify-end">
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                className="px-5 py-2 text-sm font-medium text-white bg-[#5054EA] hover:bg-[#4347D4] rounded-full transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
