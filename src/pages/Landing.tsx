import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Layers,
  Zap,
  FileText,
  Search,
  Bell,
  Sparkles,
  Calendar,
  CheckCircle2,
  Menu,
  X as XIcon,
  TrendingUp,
} from 'lucide-react'

// ─── Testimonials Data ─────────────────────────────────────────────────────────
const testimonials = [
  {
    quote:
      '“Talvyn made my job search so much easier.\nI finally feel in control and more confident.”',
    author: 'Aarav Mehta',
    role: 'Product Designer',
  },
  {
    quote:
      '“Saving jobs from LinkedIn and Indeed with one click and auto-filling forms saved me at least 15 hours every week.”',
    author: 'Sarah Chen',
    role: 'Senior Software Engineer',
  },
  {
    quote:
      '“The match scoring and application readiness check showed me exactly what was missing before applying. Landed 3 offers!”',
    author: 'Dev Patel',
    role: 'Data Analyst & Engineer',
  },
]

// ─── FAQ Data ──────────────────────────────────────────────────────────────────
const faqs = [
  {
    q: 'How does the Talvyn Chrome Extension work?',
    a: 'The extension sits quietly in your browser and automatically detects job opportunities on LinkedIn, Indeed, Unstop, Greenhouse, Lever, and company career pages. With one click, it extracts job requirements, computes your readiness score, and saves or auto-fills the application.',
  },
  {
    q: 'Can Talvyn auto-fill application forms safely?',
    a: 'Yes! Talvyn matches fields like your legal name, contact information, work history, and portfolio links directly from your verified profile. Sensitive questions (like visa status or salary expectations) are always presented for your explicit review first.',
  },
  {
    q: 'Which job boards and ATS platforms are supported?',
    a: 'Talvyn features universal job detection that works on almost any web career page, with dedicated adapters optimized for LinkedIn, Indeed, Unstop, Greenhouse, Lever, Workday, Ashby, and SmartRecruiters.',
  },
  {
    q: 'Is my candidate data kept private and secure?',
    a: 'Absolutely. Your resume data, profile details, and applications belong entirely to you. We never sell your personal data or share your application pipeline with third parties.',
  },
]

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [faqModalOpen, setFaqModalOpen] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  // Auto rotate testimonials gently every 7s if not manually navigated
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 7000)
    return () => clearInterval(timer)
  }, [])

  const nextTestimonial = () => {
    setActiveTestimonial((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setActiveTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  return (
    <div className="min-h-screen bg-[#070814] text-[#F3F4F8] font-sans antialiased selection:bg-[#6366F1]/40 selection:text-white overflow-x-hidden relative">
      {/* ─── AMBIENT ATMOSPHERIC LIGHTING & NEON RADIAL GLOWS ─── */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Top Hero radial violet glow behind dashboard card */}
        <div className="absolute top-[-15%] right-[-5%] w-[850px] h-[750px] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.22),rgba(139,92,246,0.12),transparent_70%)] blur-[100px]" />
        {/* Top Left soft blue accent glow */}
        <div className="absolute top-[5%] left-[-10%] w-[600px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.14),transparent_65%)] blur-[120px]" />
        {/* Center Mountain Path vibrant violet corona */}
        <div className="absolute top-[45%] right-[5%] w-[700px] h-[700px] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.20),rgba(99,102,241,0.10),transparent_70%)] blur-[110px]" />
        {/* Middle Left soft ambiance */}
        <div className="absolute top-[60%] left-[-8%] w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.15),transparent_65%)] blur-[120px]" />
        {/* Bottom CTA curved ambient glow */}
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.2),rgba(168,85,247,0.08),transparent_70%)] blur-[130px]" />

        {/* Subtle high-tech cosmic grid mesh */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.45) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* ─── TOP NAVBAR ─── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#070814]/80 border-b border-white/[0.07] transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Brand Logo & Wordmark */}
          <Link to="/" className="flex items-center gap-3 group focus:outline-none">
            <div className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#6366F1] to-[#4338CA] shadow-[0_0_18px_rgba(99,102,241,0.4)] group-hover:shadow-[0_0_24px_rgba(99,102,241,0.6)] transition-all duration-300">
              {/* Talvyn custom folded T shape */}
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <path d="M 7 10.5 C 7 9.12 8.12 8 9.5 8 L 14 8 L 12.5 12 L 7 12 Z" fill="white" />
                <path d="M 18 8 L 22.5 8 C 23.88 8 25 9.12 25 10.5 L 25 12 L 19.5 12 Z" fill="white" />
                <path d="M 13 11 L 16 6 L 19 11 L 18 24 C 18 25.1 17.1 26 16 26 C 14.9 26 14 25.1 14 24 Z" fill="white" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-slate-100 transition-colors">
              Talvyn
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-9 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors duration-150">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors duration-150">
              How It Works
            </a>
            <a href="#testimonials" className="hover:text-white transition-colors duration-150">
              Testimonials
            </a>
            <button
              type="button"
              onClick={() => setFaqModalOpen(true)}
              className="hover:text-white transition-colors duration-150"
            >
              FAQ
            </button>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/login"
              className="text-sm font-semibold text-slate-300 hover:text-white transition-colors duration-150"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.45)] hover:shadow-[0_0_28px_rgba(99,102,241,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
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

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden px-6 py-5 bg-[#0B0C1E]/95 border-b border-white/[0.08] backdrop-blur-xl flex flex-col gap-4 animate-in fade-in slide-in-from-top-3 duration-200">
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
            <a
              href="#testimonials"
              onClick={() => setMobileMenuOpen(false)}
              className="text-slate-300 hover:text-white font-medium text-sm py-1"
            >
              Testimonials
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                setFaqModalOpen(true)
              }}
              className="text-left text-slate-300 hover:text-white font-medium text-sm py-1"
            >
              FAQ
            </button>
            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-semibold text-slate-300 hover:text-white"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center gap-1.5 bg-[#4F46E5] text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.4)]"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headlines, Subtitles & Stats */}
          <div className="lg:col-span-6 flex flex-col items-start z-10">
            {/* Eyebrow badge */}
            <div className="text-[11px] font-bold tracking-[0.25em] text-[#818CF8] uppercase mb-4">
              YOUR CAREER, MORE CLARITY
            </div>

            {/* Main Title */}
            <h1 className="text-5xl sm:text-6xl lg:text-[72px] font-extrabold text-white tracking-tight leading-[1.08] mb-6">
              From Potential <br />
              <span className="text-[#818CF8]">to Offer.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl mb-8">
              Talvyn helps you save jobs, track applications, and stay organized — so you can focus on what really matters: landing the role you deserve.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-14">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm sm:text-base font-semibold px-7 py-3.5 rounded-full shadow-[0_0_25px_rgba(79,70,229,0.5)] hover:shadow-[0_0_35px_rgba(99,102,241,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center bg-[#0F1022]/80 hover:bg-[#181938] text-white border border-white/15 hover:border-white/30 text-sm sm:text-base font-semibold px-7 py-3.5 rounded-full transition-all duration-200"
              >
                Sign In
              </Link>
            </div>

            {/* Stat Counters Row */}
            <div className="grid grid-cols-3 gap-6 sm:gap-10 pt-4 border-t border-white/[0.08] w-full max-w-lg">
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1">
                  100K+
                </div>
                <div className="text-xs sm:text-sm text-slate-400 font-medium">
                  Jobs Saved
                </div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1">
                  50K+
                </div>
                <div className="text-xs sm:text-sm text-slate-400 font-medium">
                  Applications Tracked
                </div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1">
                  10K+
                </div>
                <div className="text-xs sm:text-sm text-slate-400 font-medium">
                  Users Growing
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Isometric Floating Dashboard Mock Card */}
          <div className="lg:col-span-6 relative flex flex-col items-center justify-center">
            {/* Ambient behind-card halo */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-[#6366F1]/30 to-[#A855F7]/20 rounded-3xl blur-2xl -z-10" />

            {/* 3D Tilted Dashboard Card */}
            <div
              className="w-full max-w-[560px] bg-[#0C0D1E]/95 border border-[#2B2956] rounded-2xl p-5 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_35px_rgba(99,102,241,0.2)] backdrop-blur-xl transition-transform duration-500 hover:rotate-0"
              style={{
                transform: 'perspective(1200px) rotateY(-8deg) rotateX(4deg)',
              }}
            >
              {/* Dashboard Top Header Bar */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.07]">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6366F1] to-[#4338CA] flex items-center justify-center">
                    <span className="text-white text-[11px] font-black">T</span>
                  </div>
                  <span className="text-xs font-bold text-white tracking-tight">Talvyn</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-400">
                  <Search className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                  <Sparkles className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                </div>
              </div>

              {/* Dashboard Internal Layout: Sidebar + Main Content */}
              <div className="grid grid-cols-12 gap-4">
                {/* Mini Left Navigation Sidebar */}
                <div className="col-span-3 flex flex-col gap-1 pr-2 border-r border-white/[0.06] text-[10.5px]">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#24224F] text-white font-semibold">
                    <TrendingUp className="w-3 h-3 text-[#A5B4FC]" />
                    <span>Overview</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-slate-200">
                    <Bookmark className="w-3 h-3" />
                    <span>Saved Jobs</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-slate-200">
                    <Layers className="w-3 h-3" />
                    <span>Applications</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-slate-200">
                    <FileText className="w-3 h-3" />
                    <span>Resumes</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-slate-200">
                    <Calendar className="w-3 h-3" />
                    <span>Notes</span>
                  </div>
                </div>

                {/* Main Dashboard Panel Content */}
                <div className="col-span-9 flex flex-col gap-3.5">
                  {/* Greeting Box */}
                  <div>
                    <div className="text-sm font-bold text-white">Welcome back</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Keep going — your next opportunity is closer than you think.
                    </div>
                  </div>

                  {/* 3 Metric Tiles Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#12132A] border border-white/[0.06] rounded-xl p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <Bookmark className="w-3 h-3 text-[#818CF8]" />
                      </div>
                      <div className="text-base font-extrabold text-white">248</div>
                      <div className="text-[9px] text-slate-400 font-medium">Saved Jobs</div>
                    </div>

                    <div className="bg-[#12132A] border border-white/[0.06] rounded-xl p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <Layers className="w-3 h-3 text-[#A855F7]" />
                      </div>
                      <div className="text-base font-extrabold text-white">86</div>
                      <div className="text-[9px] text-slate-400 font-medium">Applications</div>
                    </div>

                    <div className="bg-[#12132A] border border-white/[0.06] rounded-xl p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <Calendar className="w-3 h-3 text-[#38BDF8]" />
                      </div>
                      <div className="text-base font-extrabold text-white">12</div>
                      <div className="text-[9px] text-slate-400 font-medium">Interviews</div>
                    </div>
                  </div>

                  {/* Application Progress Bar Chart Card */}
                  <div className="bg-[#12132A] border border-white/[0.06] rounded-xl p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10.5px] font-bold text-white">Application Progress</span>
                      <span className="text-[9px] text-slate-400">Last 6 months ▾</span>
                    </div>

                    {/* Chart Bars */}
                    <div className="h-20 flex items-end justify-between gap-3 px-2 pt-2">
                      {[
                        { month: 'Jan', h: '45%' },
                        { month: 'Feb', h: '30%' },
                        { month: 'Mar', h: '75%' },
                        { month: 'Apr', h: '60%' },
                        { month: 'May', h: '95%' },
                        { month: 'Jun', h: '55%' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <div
                            style={{ height: item.h }}
                            className="w-full max-w-[14px] rounded-t-sm bg-gradient-to-t from-[#4F46E5] to-[#818CF8] shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-300 hover:brightness-125"
                          />
                          <span className="text-[8.5px] text-slate-400">{item.month}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Handwritten note with curved arrow underneath */}
            <div className="w-full max-w-[540px] flex items-center justify-end gap-2 mt-4 pr-6">
              {/* Hand-drawn curved arrow SVG */}
              <svg
                width="34"
                height="28"
                viewBox="0 0 40 32"
                fill="none"
                className="text-[#A5B4FC] stroke-current transform rotate-6"
              >
                <path
                  d="M 6 26 C 14 24, 22 18, 30 10"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M 23 8 L 31 10 L 29 17"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className="text-base text-[#C7D2FE] select-none tracking-wide"
                style={{ fontFamily: "'Caveat', 'Segoe Script', 'Brush Script MT', cursive, sans-serif" }}
              >
                Organize. Track. Grow.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: "A smarter way to manage your career" ─── */}
      <section id="features" className="py-24 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          {/* Centered Heading */}
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
              A smarter way <br />
              to manage your career
            </h2>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
              Everything you need, in one place. Talvyn brings clarity to your job search with powerful tools designed for every career path.
            </p>
          </div>

          {/* Connected Curved Arch Timeline & 4 Feature Items */}
          <div className="relative pt-8">
            {/* The SVG Connecting Curved Arch Wave Line across all 4 points */}
            <div className="hidden lg:block absolute top-0 left-0 right-0 h-28 pointer-events-none -z-0">
              <svg width="100%" height="100%" viewBox="0 0 1100 90" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4338CA" stopOpacity="0.4" />
                    <stop offset="35%" stopColor="#6366F1" stopOpacity="0.8" />
                    <stop offset="65%" stopColor="#8B5CF6" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#4338CA" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                {/* Curved wave line */}
                <path
                  d="M 130 55 C 320 20, 480 35, 680 40 C 820 45, 920 30, 970 45"
                  stroke="url(#waveGrad)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              </svg>
            </div>

            {/* 4 Feature Columns with glowing nodes on the curve */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 relative z-10">
              {/* Feature 1: Save Jobs */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left pt-2">
                {/* Glowing Node Dot */}
                <div className="w-5 h-5 rounded-full bg-[#1A1938] border border-[#6366F1] flex items-center justify-center mb-6 shadow-[0_0_12px_rgba(99,102,241,0.5)]">
                  <div className="w-2 h-2 rounded-full bg-[#818CF8]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Save Jobs</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Bookmark opportunities from LinkedIn, Indeed, company sites and more.
                </p>
              </div>

              {/* Feature 2: Track Applications */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left pt-2">
                {/* Glowing Node Dot */}
                <div className="w-5 h-5 rounded-full bg-[#1A1938] border border-[#6366F1] flex items-center justify-center mb-6 shadow-[0_0_12px_rgba(99,102,241,0.5)]">
                  <div className="w-2 h-2 rounded-full bg-[#818CF8]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Track Applications</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Know exactly where you stand and never lose track of an opportunity.
                </p>
              </div>

              {/* Feature 3: Auto-Fill Applications (Prominent Focus Node) */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left pt-2">
                {/* Glowing Concentric Node Dot */}
                <div className="relative mb-6">
                  <div className="w-7 h-7 rounded-full bg-[#6366F1]/20 border border-[#818CF8] flex items-center justify-center shadow-[0_0_20px_rgba(129,140,248,0.7)] animate-pulse">
                    <div className="w-3 h-3 rounded-full bg-[#818CF8]" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Auto-Fill Applications</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Fill job application forms faster using your saved profile. Apply with fewer mistakes.
                </p>
              </div>

              {/* Feature 4: Manage Resumes */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left pt-2">
                {/* Glowing Node Dot */}
                <div className="w-5 h-5 rounded-full bg-[#1A1938] border border-[#6366F1] flex items-center justify-center mb-6 shadow-[0_0_12px_rgba(99,102,241,0.5)]">
                  <div className="w-2 h-2 rounded-full bg-[#818CF8]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Manage Resumes</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Create and manage tailored resumes for different roles and industries.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: "Less chaos. More progress." (Winding Mountain Highway) ─── */}
      <section id="how-it-works" className="py-24 md:py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-5 flex flex-col items-start z-10">
            <div className="text-[11px] font-bold tracking-[0.25em] text-[#818CF8] uppercase mb-4">
              BUILT FOR YOUR AMBITION
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.12] mb-6">
              Less chaos. <br />
              More progress.
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-lg mb-8">
              Talvyn helps you stay organized, focused, and ahead in your job search — no matter where you are in your career.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm sm:text-base font-semibold px-6 py-3 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Right Column: Custom Illustrated Winding Mountain Highway */}
          <div className="lg:col-span-7 relative flex items-center justify-center min-h-[460px] sm:min-h-[520px]">
            {/* Mountain Ambient Violet Backlight */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-[#8B5CF6]/30 blur-[90px] pointer-events-none" />

            {/* SVG Visual Composition: Winding Violet Road & Mountain Horizon */}
            <div className="relative w-full max-w-[580px] h-[480px]">
              <svg
                viewBox="0 0 600 480"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
              >
                <defs>
                  {/* Radiant Sun/Moon Summit Glow */}
                  <radialGradient id="summitGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#E9D5FF" stopOpacity="1" />
                    <stop offset="35%" stopColor="#A855F7" stopOpacity="0.8" />
                    <stop offset="70%" stopColor="#6366F1" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                  </radialGradient>

                  {/* Ribbon Highway Surface Gradient */}
                  <linearGradient id="roadSurface" x1="200" y1="460" x2="450" y2="210" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#312E81" />
                    <stop offset="40%" stopColor="#4338CA" />
                    <stop offset="75%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#A855F7" />
                  </linearGradient>

                  {/* Road Center Glowing Dash Gradient */}
                  <linearGradient id="roadCenterLine" x1="200" y1="460" x2="450" y2="210" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#A5B4FC" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#F5D0FE" stopOpacity="1" />
                  </linearGradient>
                </defs>

                {/* 1. Distant Mountain Silhouettes */}
                <path
                  d="M 320 280 L 460 210 L 590 280 L 600 480 L 250 480 Z"
                  fill="#0D0E24"
                  opacity="0.9"
                />
                <path
                  d="M 370 240 L 460 210 L 550 255 Z"
                  fill="#181938"
                  opacity="0.8"
                />
                <path
                  d="M 50 380 L 240 260 L 410 370 L 320 480 L 0 480 Z"
                  fill="#0A0B1A"
                  opacity="0.95"
                />

                {/* 2. Radiant Summit Celestial Orb */}
                <circle cx="460" cy="210" r="32" fill="url(#summitGlow)" />
                <circle cx="460" cy="210" r="16" fill="#F5F3FF" opacity="0.95" />

                {/* 3. Winding Highway Ribbon */}
                {/* Outer highway shadow / border */}
                <path
                  d="M 120 480 C 260 480, 520 440, 520 370 C 520 310, 410 300, 410 260 C 410 230, 460 220, 460 210
                     L 462 210 C 462 220, 420 230, 420 260 C 420 300, 540 310, 540 370 C 540 445, 270 480, 130 480 Z"
                  fill="#818CF8"
                  opacity="0.3"
                />

                {/* Main Winding Road Body */}
                <path
                  d="M 140 480 
                     C 280 470, 510 435, 510 370 
                     C 510 315, 415 305, 415 260 
                     C 415 235, 458 220, 460 210
                     L 463 210
                     C 461 220, 430 235, 430 260
                     C 430 305, 535 315, 535 370
                     C 535 440, 310 472, 170 480 Z"
                  fill="url(#roadSurface)"
                  stroke="#A855F7"
                  strokeWidth="1.2"
                />

                {/* Glowing Center Dashed Road Markings */}
                <path
                  d="M 155 480 
                     C 295 471, 522 437, 522 370 
                     C 522 310, 422 305, 422 260 
                     C 422 235, 459 220, 461 210"
                  stroke="url(#roadCenterLine)"
                  strokeWidth="2"
                  strokeDasharray="8 8"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              </svg>

              {/* 4 Milestone Interactive Badges Along the Path */}
              {/* Milestone 1: Explore */}
              <div className="absolute bottom-32 left-16 sm:left-24 px-3.5 py-1 rounded-full bg-[#0F1026]/90 border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.5)] text-xs font-semibold text-slate-200">
                Explore
              </div>

              {/* Milestone 2: Apply */}
              <div className="absolute bottom-24 left-44 sm:left-56 px-3.5 py-1 rounded-full bg-[#0F1026]/90 border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.5)] text-xs font-semibold text-slate-200">
                Apply
              </div>

              {/* Milestone 3: Track */}
              <div className="absolute top-48 right-16 sm:right-20 px-3.5 py-1 rounded-full bg-[#0F1026]/90 border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.5)] text-xs font-semibold text-slate-200">
                Track
              </div>

              {/* Milestone 4: Land (Summit Destination) */}
              <div className="absolute top-28 right-8 sm:right-12 px-4 py-1 rounded-full bg-[#4F46E5] border border-[#818CF8] shadow-[0_0_15px_rgba(99,102,241,0.6)] text-xs font-bold text-white">
                Land
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 4: "Track. Plan. Move Forward." ─── */}
      <section className="py-24 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: 3D Isometric Applications Tracker Card */}
          <div className="lg:col-span-6 relative flex items-center justify-center order-2 lg:order-1">
            {/* Ambient behind-card purple glow */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-[#8B5CF6]/20 to-[#6366F1]/30 rounded-3xl blur-2xl -z-10" />

            {/* 3D Tilted Applications List Card */}
            <div
              className="w-full max-w-[520px] bg-[#0C0D1E]/95 border border-[#2B2956] rounded-2xl p-5 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_35px_rgba(99,102,241,0.2)] backdrop-blur-xl transition-transform duration-500 hover:rotate-0"
              style={{
                transform: 'perspective(1200px) rotateY(6deg) rotateX(4deg)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.07]">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6366F1] to-[#4338CA] flex items-center justify-center">
                    <span className="text-white text-[11px] font-black">T</span>
                  </div>
                  <span className="text-sm font-bold text-white">Applications</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Search className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                  <Layers className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                </div>
              </div>

              {/* 4 Application Rows */}
              <div className="flex flex-col gap-2.5">
                {/* Row 1: Notion */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#12132A] border border-white/[0.06] hover:border-white/15 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center border border-white/10 font-black text-white text-xs">
                      N
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Product Designer</div>
                      <div className="text-[10px] text-slate-400">Notion</div>
                    </div>
                  </div>
                  <span className="text-[11px] px-3 py-1 rounded-full font-medium bg-[#1F213D] text-[#A5B4FC] border border-[#3E4378]">
                    Applied
                  </span>
                </div>

                {/* Row 2: Google */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#12132A] border border-white/[0.06] hover:border-white/15 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-white/10 font-bold text-slate-800 text-xs">
                      G
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Software Engineer</div>
                      <div className="text-[10px] text-slate-400">Google</div>
                    </div>
                  </div>
                  <span className="text-[11px] px-3 py-1 rounded-full font-semibold bg-[#3B2F7E] text-[#E0E7FF] border border-[#6366F1]/50 shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                    Interview
                  </span>
                </div>

                {/* Row 3: Spotify */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#12132A] border border-white/[0.06] hover:border-white/15 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1DB954] flex items-center justify-center font-black text-black text-xs">
                      S
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Growth Manager</div>
                      <div className="text-[10px] text-slate-400">Spotify</div>
                    </div>
                  </div>
                  <span className="text-[11px] px-3 py-1 rounded-full font-medium bg-[#1A1B2F] text-slate-300 border border-white/10">
                    Saved
                  </span>
                </div>

                {/* Row 4: Microsoft */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#12132A] border border-white/[0.06] hover:border-white/15 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#00A4EF]/20 border border-[#00A4EF]/40 flex items-center justify-center font-bold text-[#38BDF8] text-xs">
                      M
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Data Analyst</div>
                      <div className="text-[10px] text-slate-400">Microsoft</div>
                    </div>
                  </div>
                  <span className="text-[11px] px-3 py-1 rounded-full font-medium bg-[#1F213D] text-[#A5B4FC] border border-[#3E4378]">
                    Applied
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Copy & CTA */}
          <div className="lg:col-span-6 flex flex-col items-start z-10 order-1 lg:order-2">
            <div className="text-[11px] font-bold tracking-[0.25em] text-[#818CF8] uppercase mb-4">
              STAY IN CONTROL
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.12] mb-6">
              Track. Plan. <br />
              Move Forward.
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-lg mb-8">
              Get a clear view of your applications, set reminders, and never miss a follow-up. Talvyn keeps your job search on track, so you can focus on what's next.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm sm:text-base font-semibold px-6 py-3 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SECTION 5: "Loved by job seekers" (Testimonials Carousel) ─── */}
      <section id="testimonials" className="py-24 md:py-32 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 text-center">
          {/* Eyebrow & Title */}
          <div className="text-[11px] font-bold tracking-[0.25em] text-[#818CF8] uppercase mb-3">
            REAL PEOPLE. REAL PROGRESS.
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
            Loved by job seekers
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto mb-16">
            Talvyn has helped thousands stay organized and land better opportunities.
          </p>

          {/* Testimonial Quote Carousel */}
          <div className="relative flex items-center justify-between max-w-4xl mx-auto min-h-[160px]">
            {/* Left Prev Arrow Button */}
            <button
              type="button"
              onClick={prevTestimonial}
              className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
              aria-label="Previous Testimonial"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Quote Center Box */}
            <div className="flex-1 px-4 sm:px-12 transition-all duration-300">
              <p className="text-xl sm:text-2xl md:text-3xl font-medium text-white leading-snug whitespace-pre-line mb-6">
                {testimonials[activeTestimonial].quote}
              </p>
              <div className="text-sm font-bold text-white">
                {testimonials[activeTestimonial].author}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {testimonials[activeTestimonial].role}
              </div>
            </div>

            {/* Right Next Arrow Button */}
            <button
              type="button"
              onClick={nextTestimonial}
              className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
              aria-label="Next Testimonial"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* 3 Pagination Indicator Dots */}
          <div className="flex items-center justify-center gap-2 mt-10">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveTestimonial(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  activeTestimonial === idx ? 'w-5 bg-white' : 'bg-white/25 hover:bg-white/50'
                }`}
                aria-label={`Go to testimonial ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 6: "Take control of your career journey" (Bottom CTA Banner) ─── */}
      <section className="py-24 md:py-32 relative text-center">
        {/* Ambient background glow ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.25),transparent_70%)] blur-[90px] pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto px-6">
          <div className="text-[11px] font-bold tracking-[0.25em] text-[#818CF8] uppercase mb-4">
            YOUR NEXT OPPORTUNITY AWAITS
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight mb-5">
            Take control of your career journey
          </h2>
          <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto mb-9">
            Join thousands of job seekers who are landing better opportunities with Talvyn.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-base font-semibold px-8 py-3.5 rounded-full shadow-[0_0_30px_rgba(79,70,229,0.55)] hover:shadow-[0_0_40px_rgba(99,102,241,0.8)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.08] bg-[#05060F] pt-14 pb-12 text-sm text-slate-400">
        <div className="max-w-7xl mx-auto px-6">
          {/* Top Row: Brand on Left, Horizontal Nav on Right */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-12 border-b border-white/[0.06]">
            <div>
              <Link to="/" className="flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#4338CA] flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.3)]">
                  <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                    <path d="M 7 10.5 C 7 9.12 8.12 8 9.5 8 L 14 8 L 12.5 12 L 7 12 Z" fill="white" />
                    <path d="M 18 8 L 22.5 8 C 23.88 8 25 9.12 25 10.5 L 25 12 L 19.5 12 Z" fill="white" />
                    <path d="M 13 11 L 16 6 L 19 11 L 18 24 C 18 25.1 17.1 26 16 26 C 14.9 26 14 25.1 14 24 Z" fill="white" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-white tracking-tight">Talvyn</span>
              </Link>
              <p className="text-xs text-slate-500">A smarter way to a brighter tomorrow.</p>
            </div>

            {/* Navigation links */}
            <div className="flex flex-wrap items-center gap-7 text-xs font-medium text-slate-300">
              <a href="#features" className="hover:text-white transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-white transition-colors">
                How It Works
              </a>
              <a href="#testimonials" className="hover:text-white transition-colors">
                Testimonials
              </a>
              <button
                type="button"
                onClick={() => setFaqModalOpen(true)}
                className="hover:text-white transition-colors"
              >
                FAQ
              </button>
            </div>
          </div>

          {/* Bottom Row: Copyright, Legal & Social Links */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs text-slate-500">
            <div>© 2024 Talvyn. All rights reserved.</div>

            <div className="flex items-center gap-6">
              <a href="#privacy" onClick={(e) => { e.preventDefault(); alert('Talvyn Privacy Policy: Your candidate data is strictly private and never shared.') }} className="hover:text-slate-300 transition-colors">
                Privacy
              </a>
              <a href="#terms" onClick={(e) => { e.preventDefault(); alert('Talvyn Terms of Service: Designed to empower job seekers globally.') }} className="hover:text-slate-300 transition-colors">
                Terms
              </a>
              <a href="mailto:support@talvyn.com" className="hover:text-slate-300 transition-colors">
                Contact
              </a>

              {/* Social Icons: X, LinkedIn, YouTube */}
              <div className="flex items-center gap-3.5 ml-2">
                {/* X / Twitter */}
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label="X (Twitter)"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>

                {/* LinkedIn */}
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label="LinkedIn"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64c-.88 0-1.6.72-1.6 1.6 0 .88.72 1.6 1.6 1.6.88 0 1.6-.72 1.6-1.6 0-.88-.72-1.6-1.6-1.6Z" />
                  </svg>
                </a>

                {/* YouTube */}
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label="YouTube"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── FAQ INTERACTIVE MODAL ─── */}
      {faqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-[#0C0D1E] border border-[#2B2956] rounded-2xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.9)] max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/[0.08]">
              <div>
                <div className="text-[10.5px] font-bold tracking-[0.2em] text-[#818CF8] uppercase">
                  FREQUENTLY ASKED QUESTIONS
                </div>
                <h3 className="text-xl font-bold text-white mt-1">Got questions? We're here to help.</h3>
              </div>
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close FAQ Modal"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Accordion Questions */}
            <div className="flex flex-col gap-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx
                return (
                  <div
                    key={idx}
                    className="border border-white/[0.07] rounded-xl overflow-hidden bg-[#12132A]"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full text-left px-4 py-3.5 flex items-center justify-between text-sm font-semibold text-white hover:bg-white/[0.02] transition-colors"
                    >
                      <span>{faq.q}</span>
                      <span className="text-slate-400 text-base ml-2">{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-white/[0.04]">
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Modal Bottom Action */}
            <div className="mt-8 pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <span className="text-xs text-slate-400">Ready to start landing interviews?</span>
              <Link
                to="/signup"
                onClick={() => setFaqModalOpen(false)}
                className="inline-flex items-center gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.4)]"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
