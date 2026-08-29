import { Link } from 'react-router-dom'
import {
  Globe,
  BarChart3,
  Zap,
  FileStack,
  StickyNote,
  ArrowRight,
  CheckCircle,
} from 'lucide-react'
import { Button } from '../components/ui/Button'

const features = [
  {
    icon: Globe,
    title: 'Universal Job Saving',
    description: 'Save job opportunities from any platform — LinkedIn, Indeed, company sites, and more — all in one place.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: BarChart3,
    title: 'Application Tracking',
    description: 'Track every stage of your applications. Know exactly where you stand with every opportunity.',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: Zap,
    title: 'Application Autofill',
    description: 'Fill job application forms instantly using your saved profile. Apply faster, with fewer mistakes.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: FileStack,
    title: 'Multiple Resumes',
    description: 'Manage different resume versions for different roles. Keep your best version ready for each opportunity.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: StickyNote,
    title: 'Job Notes',
    description: 'Add personal notes to each job — track follow-ups, interview prep, recruiter contacts, and deadlines.',
    color: 'bg-amber-50 text-amber-600',
  },
]

const stats = [
  { value: '10+', label: 'Job Boards Supported' },
  { value: '100%', label: 'Free to Start' },
  { value: '1 Place', label: 'For All Applications' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-sm font-bold">T</span>
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">Talvyn</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-50 rounded-full -translate-y-1/2 translate-x-1/3 opacity-60" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-50 rounded-full translate-y-1/3 -translate-x-1/4 opacity-40" />
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-full text-xs font-semibold text-primary-700 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
            Now in Beta — Free for Early Access
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight leading-tight mb-6">
            From Potential
            <br />
            <span className="text-primary-600">to Offer.</span>
          </h1>

          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-10">
            Talvyn is the universal career management platform that helps you save jobs, track applications, and land the role you deserve — no matter your field.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Link to="/signup">
              <Button size="lg" className="min-w-[180px]">
                Start for Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg">
                Sign In
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                <div className="text-sm text-slate-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-surface-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Everything you need to land your next role
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Whether you're in software, design, marketing, finance, or any other field — Talvyn is built for every career path.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="bg-white rounded-2xl p-6 border border-slate-100 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200"
                >
                  <div className={`w-12 h-12 rounded-2xl ${feature.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Get started in minutes</h2>
            <p className="text-lg text-slate-500">Three simple steps to take control of your job search.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Create your profile', desc: 'Set up your professional profile with your skills, experience, and application preferences.' },
              { step: '02', title: 'Save job opportunities', desc: 'Add jobs manually or use our upcoming Chrome extension to capture jobs from any website.' },
              { step: '03', title: 'Track & apply', desc: 'Move jobs through your pipeline, take notes, and stay on top of every application.' },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-start">
                <div className="text-4xl font-bold text-primary-100 mb-4">{item.step}</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to take control of your career?
          </h2>
          <p className="text-primary-100 text-lg mb-8">
            Join thousands of professionals who use Talvyn to manage their job search smarter.
          </p>
          <Link to="/signup">
            <Button className="bg-white text-primary-700 hover:bg-primary-50 h-12 px-8 text-base">
              Get Started — It's Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">T</span>
            </div>
            <span className="font-semibold text-slate-900">Talvyn</span>
          </div>
          <p className="text-sm text-slate-400">© 2025 Talvyn. From Potential to Offer.</p>
        </div>
      </footer>
    </div>
  )
}
