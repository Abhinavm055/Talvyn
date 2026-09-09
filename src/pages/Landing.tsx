import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bookmark,
  Compass,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Layers,
  Zap,
  ShieldCheck,
  ChevronRight,
  Menu,
  X,
  Target,
  FileText,
  BarChart3,
  Search,
  ExternalLink,
} from 'lucide-react'

// Core feature items for "Your career, finally in one place"
const coreFeatures = [
  {
    id: 'save',
    title: 'Save Every Opportunity',
    tagline: 'Capture from anywhere in 1 click',
    description:
      'Save jobs directly from LinkedIn, Indeed, Unstop, Greenhouse, Lever, and custom company career portals with full metadata extracted automatically.',
    icon: Bookmark,
    badge: 'Universal Capture',
    highlight: 'LinkedIn • Indeed • Unstop • ATS',
  },
  {
    id: 'track',
    title: 'Track Every Application',
    tagline: 'Visual momentum across your pipeline',
    description:
      'Know exactly where every opportunity stands. Move applications through clean stages from Saved to Applied, Interviewing, and Offer.',
    icon: Layers,
    badge: 'Pipeline Intelligence',
    highlight: 'Saved → Applied → Interview → Offer',
  },
  {
    id: 'momentum',
    title: 'Build Career Momentum',
    tagline: 'Turn scattered notes into a focused strategy',
    description:
      'Attach personal interview notes, track key recruiter contacts, log compensation ranges, and never let a critical follow-up slip through.',
    icon: TrendingUp,
    badge: 'Organized Velocity',
    highlight: 'Notes • Follow-ups • Timelines',
  },
  {
    id: 'advance',
    title: 'Move From Applying to Advancing',
    tagline: 'Profile match scores & readiness verification',
    description:
      'Evaluate your role alignment before submitting. Discover skill matches, detect experience gaps, and tailor resume versions for every application.',
    icon: Target,
    badge: 'Decision Intelligence',
    highlight: 'Match Breakdown • Resume Targeting',
  },
]

// 3 Steps for "How It Works"
const steps = [
  {
    num: '01',
    title: 'Set up your career profile',
    description:
      'Define your target roles, skills, and experience preferences once. Talvyn uses this blueprint to score every opportunity you explore.',
  },
  {
    num: '02',
    title: 'Capture jobs anywhere on the web',
    description:
      'Browse normally. Use the Talvyn extension to inspect match ratings, extract salary ranges, and save roles to your tracker in one click.',
  },
  {
    num: '03',
    title: 'Track, prepare & land the offer',
    description:
      'Keep follow-up dates on your calendar, match targeted resumes, log interview feedback, and negotiate your next offer with calm confidence.',
  },
]

// Ecosystem supported logos/platforms
const supportedPlatforms = [
  { name: 'LinkedIn', category: 'Job Board' },
  { name: 'Indeed', category: 'Job Board' },
  { name: 'Unstop', category: 'Student & Tech' },
  { name: 'Greenhouse', category: 'ATS' },
  { name: 'Lever', category: 'ATS' },
  { name: 'Workday', category: 'Enterprise ATS' },
  { name: 'Ashby', category: 'Modern ATS' },
  { name: 'SmartRecruiters', category: 'Global Portal' },
]

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#070711] text-[#F3F4F8] font-sans antialiased selection:bg-[#5B4BFF]/30 selection:text-[#FFFFFF] overflow-x-hidden relative">
      {/* ── Ambient Background Lighting (Subtle, Layered & Non-Distracting) ── */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Top central ambient radial violet glow */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-[radial-gradient(ellipse_at_center,rgba(91,75,255,0.15),transparent_70%)] blur-[90px]" />
        {/* Secondary soft purple ambient glow on right edge */}
        <div className="absolute top-[25%] right-[-15%] w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(124,92,255,0.08),transparent_70%)] blur-[120px]" />
        {/* Subtle bottom-left glow */}
        <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(109,93,252,0.07),transparent_70%)] blur-[140px]" />
        {/* Very subtle noise-like grid overlay for depth */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* ── HEADER NAVIGATION ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#070711]/75 border-b border-white/[0.08] transition-all">
        <div className="max-w-[1240px] mx-auto px-6 h-18 flex items-center justify-between">
          {/* Brand Logo & Wordmark */}
          <Link to="/" className="flex items-center gap-3 group focus:outline-hidden">
            <div className="relative w-9 h-9 rounded-xl p-0.5 bg-gradient-to-br from-[#6D5DFC]/30 to-[#5B4BFF]/10 border border-white/10 flex items-center justify-center shadow-[0_0_14px_rgba(109,93,252,0.25)] group-hover:border-[#6D5DFC]/50 transition-all duration-200">
              <img
                src="/logotalvyn.png"
                alt="Talvyn"
                className="w-7 h-7 rounded-lg object-contain"
              />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#F3F4F8] transition-colors">
                Talvyn
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-widest px-1.5 py-0.5 rounded-md bg-[#5B4BFF]/15 text-[#9485FF] border border-[#5B4BFF]/25">
                Beta
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#9BA1B5]">
            <a
              href="#product"
              className="hover:text-white transition-colors duration-150 tracking-wide"
            >
              Product
            </a>
            <a
              href="#how-it-works"
              className="hover:text-white transition-colors duration-150 tracking-wide"
            >
              How It Works
            </a>
            <a
              href="#features"
              className="hover:text-white transition-colors duration-150 tracking-wide"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="hover:text-white transition-colors duration-150 tracking-wide"
            >
              Pricing
            </a>
          </nav>

          {/* Desktop Right CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-[#9BA1B5] hover:text-white hover:bg-white/[0.04] rounded-xl border border-transparent hover:border-white/[0.08] transition-all duration-150"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="relative inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-[#6D5DFC] to-[#5B4BFF] hover:from-[#7C5CFF] hover:to-[#6355FF] shadow-[0_0_18px_rgba(91,75,255,0.35)] hover:shadow-[0_0_24px_rgba(109,93,252,0.55)] border border-white/10 hover:border-white/20 transition-all duration-200 active:scale-[0.98]"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#9BA1B5] hover:text-white focus:outline-hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden px-6 pt-3 pb-6 bg-[#0B0C1A] border-b border-white/[0.08] flex flex-col gap-4 animate-in fade-in duration-200">
            <nav className="flex flex-col gap-3 text-sm font-medium text-[#9BA1B5]">
              <a
                href="#product"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white transition-colors"
              >
                Product
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white transition-colors"
              >
                How It Works
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white transition-colors"
              >
                Features
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white transition-colors"
              >
                Pricing
              </a>
            </nav>
            <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2.5">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-medium text-[#9BA1B5] hover:text-white rounded-xl bg-white/[0.04] border border-white/[0.08]"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-[#6D5DFC] to-[#5B4BFF] shadow-[0_0_18px_rgba(91,75,255,0.4)]"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative pt-16 md:pt-24 pb-20 overflow-hidden">
        <div className="max-w-[1240px] mx-auto px-6 text-center">
          {/* Beta Announcement Pill */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.1] hover:border-[#6D5DFC]/40 transition-colors mb-8 shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7C5CFF] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6D5DFC]" />
            </span>
            <span className="text-xs font-medium text-[#C8CCDB] tracking-wide">
              Now in Beta — Free for Early Access
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#868C9F]" />
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[80px] font-extrabold text-white tracking-tight leading-[1.08] max-w-4xl mx-auto mb-6">
            From Potential{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7C5CFF] via-[#8F81FD] to-[#5B4BFF]">
              to Offer.
            </span>
          </h1>

          {/* Supporting Copy */}
          <p className="text-lg sm:text-xl text-[#9BA1B5] max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
            Talvyn is the universal career management platform that helps you
            save jobs, track applications, and land the role you deserve — no
            matter your field.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link
              to="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 text-base font-semibold text-white rounded-xl bg-gradient-to-r from-[#6D5DFC] to-[#5B4BFF] hover:from-[#7C5CFF] hover:to-[#6355FF] shadow-[0_0_24px_rgba(91,75,255,0.4)] hover:shadow-[0_0_36px_rgba(109,93,252,0.6)] border border-white/15 transition-all duration-200 active:scale-[0.98]"
            >
              Start for Free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 text-base font-medium text-[#C8CCDB] hover:text-white rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.1] hover:border-white/[0.2] transition-all duration-150"
            >
              Sign In
            </Link>
          </div>

          {/* Micro Trust Signals */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#7E849A] font-medium mb-16">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#6D5DFC]" />
              No credit card required
            </span>
            <span className="hidden sm:inline text-white/15">•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#6D5DFC]" />
              Instant 30-second setup
            </span>
            <span className="hidden sm:inline text-white/15">•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#6D5DFC]" />
              Universal browser extension included
            </span>
          </div>

          {/* ── HERO VISUAL: ABSTRACT CAREER INTELLIGENCE SYSTEM ── */}
          <div
            id="product"
            className="relative max-w-[1080px] mx-auto rounded-2xl bg-[#0B0C1A]/80 border border-white/[0.09] p-4 sm:p-7 shadow-[0_20px_70px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all"
          >
            {/* Ambient inner card top glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-[#6D5DFC]/60 to-transparent" />

            {/* Stage 1: Pipeline Progression Ribbon */}
            <div className="mb-6 pb-6 border-b border-white/[0.07]">
              <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto">
                {[
                  { stage: 'Potential', desc: 'Profile Ready', active: true, icon: Sparkles },
                  { stage: 'Opportunity', desc: 'Discovered', active: true, icon: Search },
                  { stage: 'Application', desc: 'In Pipeline', active: true, icon: Layers },
                  { stage: 'Offer', desc: 'Goal Achieved', active: true, icon: CheckCircle2 },
                ].map((item, idx, arr) => {
                  const Icon = item.icon
                  const isLast = idx === arr.length - 1
                  return (
                    <React.Fragment key={item.stage}>
                      <div className="flex flex-col items-center text-center group">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#121428] to-[#0A0B16] border border-[#6D5DFC]/40 flex items-center justify-center text-white shadow-[0_0_12px_rgba(109,93,252,0.25)] mb-1.5">
                          <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#8F81FD]" />
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">
                          {item.stage}
                        </span>
                        <span className="text-[10px] text-[#7E849A] hidden sm:block">
                          {item.desc}
                        </span>
                      </div>
                      {!isLast && (
                        <div className="flex-1 h-[2px] bg-gradient-to-r from-[#6D5DFC]/60 via-[#5B4BFF]/40 to-[#6D5DFC]/60 mx-1 sm:mx-3 relative rounded-full">
                          <div className="absolute inset-0 bg-[#7C5CFF]/30 blur-[2px]" />
                        </div>
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            </div>

            {/* Stage 2: Dual Intelligence Workspaces Showcase */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-left items-stretch">
              {/* Left Column (7 cols): Real Captured Opportunity Workspace Card */}
              <div className="lg:col-span-7 rounded-xl bg-[#0F1023]/90 border border-white/[0.08] p-5 sm:p-6 flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#5B4BFF]/15 text-[#9485FF] border border-[#5B4BFF]/25 mb-2">
                        <Compass className="w-3 h-3 text-[#7C5CFF]" />
                        Universal Extension Captured
                      </span>
                      <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                        Senior Full Stack Engineer
                      </h3>
                      <p className="text-xs sm:text-sm text-[#9BA1B5]">
                        Stripe • Bengaluru / Remote • Engineering
                      </p>
                    </div>

                    {/* Match Score Badge */}
                    <div className="flex flex-col items-end">
                      <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs sm:text-sm flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                        <span>94%</span>
                        <span className="text-[10px] font-medium text-emerald-300">Match</span>
                      </div>
                      <span className="text-[10px] text-[#7E849A] mt-1">High Readiness</span>
                    </div>
                  </div>

                  {/* Metadata Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs text-[#C8CCDB]">
                      ₹30,00,000 – ₹42,00,000 PA
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs text-[#C8CCDB]">
                      Full Time
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs text-[#C8CCDB]">
                      3+ yrs experience
                    </span>
                  </div>

                  {/* Matched Skills Chips */}
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7E849A] mb-2">
                      Target Skills Matched
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'System Design'].map(
                        (skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#6D5DFC]/10 border border-[#6D5DFC]/25 text-xs text-[#C8CCDB]"
                          >
                            <CheckCircle2 className="w-3 h-3 text-[#6D5DFC]" />
                            {skill}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#868C9F]">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Saved to Active Tracker Pipeline
                  </span>
                  <span className="text-[#868C9F] flex items-center gap-1">
                    Applied on Sept 8 <ExternalLink className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </div>

              {/* Right Column (5 cols): Intelligence Breakdown & Pipeline Status */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                {/* Micro Box 1: Career Readiness Radar */}
                <div className="rounded-xl bg-[#0F1023]/90 border border-white/[0.08] p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#9BA1B5] flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-[#7C5CFF]" />
                      Candidate Match Radar
                    </span>
                    <span className="text-xs font-semibold text-[#8F81FD]">Strong Match</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <div className="flex justify-between text-[#C8CCDB] mb-1">
                        <span>Role Compatibility</span>
                        <span className="text-emerald-400 font-semibold">100% Match</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#6D5DFC] to-emerald-400 rounded-full w-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[#C8CCDB] mb-1">
                        <span>Core Technical Skills</span>
                        <span className="text-emerald-400 font-semibold">90% Match</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#6D5DFC] to-[#5B4BFF] rounded-full w-[90%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[#C8CCDB] mb-1">
                        <span>Experience Level</span>
                        <span className="text-emerald-400 font-semibold">Matched (3+ Yrs)</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full bg-[#6D5DFC] rounded-full w-[95%]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Micro Box 2: Visual Kanban Mini-Board */}
                <div className="rounded-xl bg-[#0F1023]/90 border border-white/[0.08] p-4 sm:p-5 flex-1 flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#9BA1B5] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#7C5CFF]" />
                      Active Applications
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.05] text-[#C8CCDB]">
                      6 Active Roles
                    </span>
                  </div>

                  {/* Visual mini columns */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                      <div className="text-[#868C9F] font-medium mb-1">Saved</div>
                      <div className="text-sm font-bold text-white">3</div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#5B4BFF]/10 border border-[#5B4BFF]/25">
                      <div className="text-[#8F81FD] font-medium mb-1">Interview</div>
                      <div className="text-sm font-bold text-white">2</div>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                      <div className="text-emerald-400 font-medium mb-1">Offer</div>
                      <div className="text-sm font-bold text-emerald-300">1</div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#7E849A]">
                    <span>Interview: System Architecture</span>
                    <span className="text-white font-medium">Tomorrow, 3 PM</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: CAREER INTELLIGENCE FEATURE GRID ── */}
      <section id="features" className="py-24 relative border-t border-white/[0.06]">
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5B4BFF]/10 border border-[#5B4BFF]/25 text-xs font-semibold text-[#9485FF] mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Career Operating System
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Your career, finally in one place.
            </h2>
            <p className="text-base sm:text-lg text-[#9BA1B5] leading-relaxed">
              Capture opportunities, organize applications, and understand where every
              opportunity stands — without juggling disconnected tabs and spreadsheets.
            </p>
          </div>

          {/* 4 Premium Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {coreFeatures.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.id}
                  className="group relative rounded-2xl bg-[#0B0C1A] border border-white/[0.08] p-7 hover:border-[#6D5DFC]/40 hover:bg-[#0D0E20] transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_rgba(91,75,255,0.15)] flex flex-col justify-between"
                >
                  <div>
                    {/* Top Icon & Badge Header */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1A1838] to-[#101026] border border-[#6D5DFC]/30 flex items-center justify-center text-white shadow-[0_0_16px_rgba(109,93,252,0.2)] group-hover:border-[#6D5DFC]/60 transition-colors">
                        <Icon className="w-6 h-6 text-[#8F81FD]" />
                      </div>
                      <span className="text-xs font-semibold text-[#8F81FD] px-2.5 py-1 rounded-full bg-[#5B4BFF]/10 border border-[#5B4BFF]/20">
                        {feature.badge}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-white transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-xs font-semibold text-[#8F81FD] mb-3">
                      {feature.tagline}
                    </p>
                    <p className="text-sm text-[#9BA1B5] leading-relaxed mb-6">
                      {feature.description}
                    </p>
                  </div>

                  {/* Micro Visual Tagline */}
                  <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#7E849A]">
                    <span className="font-mono text-[#C8CCDB] tracking-wide">
                      {feature.highlight}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#868C9F] group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 relative border-t border-white/[0.06] bg-[#090A16]/50">
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              From potential to offer in three seamless steps
            </h2>
            <p className="text-base text-[#9BA1B5]">
              Designed to bring discipline, clarity, and velocity to your job search.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((item, idx) => (
              <div
                key={item.num}
                className="relative rounded-2xl bg-[#0B0C1A] border border-white/[0.08] p-7 flex flex-col justify-between group hover:border-[#6D5DFC]/35 transition-all duration-200"
              >
                <div>
                  <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#6D5DFC] to-[#362D9A] mb-4 font-mono">
                    {item.num}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2.5">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[#9BA1B5] leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.05] flex items-center gap-2 text-xs text-[#8F81FD] font-semibold">
                  <span>Step {idx + 1} of 3</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: UNIVERSAL ECOSYSTEM ── */}
      <section className="py-20 relative border-t border-white/[0.06]">
        <div className="max-w-[1240px] mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs font-medium text-[#C8CCDB] mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-[#7C5CFF]" />
            Universal DOM Extraction Engine
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
            Works everywhere you look for work.
          </h2>
          <p className="text-sm sm:text-base text-[#9BA1B5] max-w-xl mx-auto mb-12">
            No proprietary platform lock-in. Powered by Talvyn's Universal Page Scanner that understands job postings on any web page.
          </p>

          {/* Grid of Supported ATS & Portals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-4xl mx-auto">
            {supportedPlatforms.map((platform) => (
              <div
                key={platform.name}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.04] transition-all flex flex-col items-center justify-center text-center"
              >
                <span className="text-sm font-bold text-white tracking-wide">
                  {platform.name}
                </span>
                <span className="text-[11px] text-[#7E849A] mt-0.5">
                  {platform.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: TRANSPARENT BETA PRICING ── */}
      <section id="pricing" className="py-24 relative border-t border-white/[0.06] bg-[#090A16]/50">
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Simple, early-access pricing
            </h2>
            <p className="text-base text-[#9BA1B5]">
              Get started free today with full access during our public beta.
            </p>
          </div>

          <div className="max-w-md mx-auto rounded-2xl bg-[#0B0C1A] border border-[#6D5DFC]/40 p-8 shadow-[0_0_40px_rgba(91,75,255,0.15)] relative">
            <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#6D5DFC] to-[#5B4BFF] text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
              Early Access
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-1">Talvyn Beta</h3>
              <p className="text-xs text-[#9BA1B5]">
                Full career intelligence workspace for professionals.
              </p>
            </div>

            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-extrabold text-white">₹0</span>
              <span className="text-sm text-[#868C9F]">/ free forever for early adopters</span>
            </div>

            <ul className="space-y-3 text-xs sm:text-sm text-[#C8CCDB] mb-8">
              {[
                'Universal Browser Extension (1-click save)',
                'Visual Kanban application pipeline tracker',
                'Candidate profile & target role match scoring',
                'Multiple resume versions & targeting',
                'Personal interview notes & activity timelines',
                'Smart application autofill assistance',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#6D5DFC] shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/signup"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-[#6D5DFC] to-[#5B4BFF] hover:from-[#7C5CFF] hover:to-[#6355FF] shadow-[0_0_20px_rgba(91,75,255,0.4)] transition-all"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: CONVERSION CTA BANNER ── */}
      <section className="py-24 relative border-t border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(91,75,255,0.12),transparent_70%)]" />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-5">
            Ready to take control of your career?
          </h2>
          <p className="text-base sm:text-lg text-[#9BA1B5] max-w-xl mx-auto mb-9 leading-relaxed">
            Join ambitious professionals who use Talvyn to turn job hunting into
            an organized, high-confidence career advancement system.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 text-base font-semibold text-white rounded-xl bg-gradient-to-r from-[#6D5DFC] to-[#5B4BFF] hover:from-[#7C5CFF] hover:to-[#6355FF] shadow-[0_0_28px_rgba(91,75,255,0.45)] hover:shadow-[0_0_36px_rgba(109,93,252,0.65)] border border-white/15 transition-all duration-200"
            >
              Start for Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-medium text-[#C8CCDB] hover:text-white rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.1] transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 border-t border-white/[0.08] bg-[#05050C]">
        <div className="max-w-[1240px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg p-0.5 bg-[#121428] border border-white/10 flex items-center justify-center">
              <img src="/logotalvyn.png" alt="Talvyn" className="w-5 h-5 rounded-sm object-contain" />
            </div>
            <span className="font-bold text-white tracking-tight">Talvyn</span>
            <span className="text-xs text-[#7E849A] hidden sm:inline">
              — From Potential to Offer.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#9BA1B5]">
            <a href="#product" className="hover:text-white transition-colors">
              Product
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </a>
            <Link to="/login" className="hover:text-white transition-colors">
              Sign In
            </Link>
            <Link to="/signup" className="hover:text-white transition-colors">
              Sign Up
            </Link>
          </div>

          <p className="text-xs text-[#6A6F82]">
            © 2026 Talvyn. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
