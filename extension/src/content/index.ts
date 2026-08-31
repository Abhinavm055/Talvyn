/**
 * Talvyn Content Script – Smart Page Coordinator (Phase 2A + 2B + 2C + 2D)
 *
 * Coordinates:
 * 1. Application Success Detection & Auto-Tracking (Phase 2D): Detects post-submit confirmation, tracks applied job, and shows notification with Undo.
 * 2. Application Form Autofill (Phase 2C): Detects application forms, maps fields, and displays Autofill Panel.
 * 3. Smart Job List Discovery (Phase 2B): Detects multi-job listings, scores relevance, and displays Discovery Panel.
 * 4. Single Job Saver (Phase 2A): Detects individual postings and displays Save to Talvyn widget.
 * 5. Observes SPA dynamic navigation & DOM changes with debounced re-evaluation.
 */

import { jobScanner } from './scanner'
import { detectJob } from './detector'
import { injectPanel, updatePanelState, removePanel } from './panel'
import { discoveryPanelManager } from './discoveryPanel'
import { autofillCoordinator } from './autofill/autofillCoordinator'
import { assistantCoordinator } from './applicationAssistant/assistantCoordinator'
import { applicationSuccessDetector } from './applicationDetection/successDetector'
import { applicationSessionManager } from './applicationDetection/applicationSession'
import { navigationObserver } from './navigationObserver'
import { opportunityClassifier } from '../opportunityDetection/opportunityClassifier'
import { readinessScorer } from '../services/readinessScorer'
import { resumesService } from '../services/resumesService'
import { getToken, getUser, setToken, setUser, clearAuth } from '../utils/storage'
import { jobsService } from '../services/jobsService'
import { profileService } from '../services/profileService'
import { ExtractedJob, UserProfile, AnalyzedJob, Resume } from '../types'

let currentSingleJob: ExtractedJob | null = null
let isSinglePanelVisible = false
let isDiscoveryPanelVisible = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Announce extension presence to Talvyn web app for automatic discovery
try {
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    document.documentElement.setAttribute('data-talvyn-extension-id', chrome.runtime.id)
    window.dispatchEvent(new CustomEvent('talvyn:extension-ready', { detail: { extensionId: chrome.runtime.id } }))
  }
} catch {
  /* ignore */
}


const DEFAULT_GUEST_PROFILE: UserProfile = {
  id: 'guest',
  userId: 'guest',
  preferredRoles: [],
  preferredLocations: [],
  preferredJobTypes: [],
  skills: [],
  otherLinks: [],
  experienceYears: null,
  workStyle: 'ANY',
  onboardingCompleted: false,
}

async function getUserPreferences(): Promise<UserProfile> {
  const token = await getToken()
  const user = await getUser()

  if (token && user?.profile) {
    return user.profile
  }

  if (token) {
    try {
      const liveProfile = await profileService.get()
      return liveProfile
    } catch {
      /* fallback */
    }
  }

  return DEFAULT_GUEST_PROFILE
}

function isTalvynAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'talvyn.vercel.app' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    ) {
      const p = parsed.pathname.toLowerCase()
      // Skip job scanning on all Talvyn application and auth routes
      if (
        p.startsWith('/extension') ||
        p.startsWith('/extensions') ||
        p.startsWith('/login') ||
        p.startsWith('/signup') ||
        p.startsWith('/onboarding') ||
        p.startsWith('/dashboard') ||
        p.startsWith('/tracker') ||
        p.startsWith('/profile') ||
        p.startsWith('/resumes') ||
        p.startsWith('/jobs')
      ) {
        return true
      }
    }
  } catch {
    /* fallback */
  }
  return false
}

async function analyzeAndRenderPage(): Promise<void> {
  const url = window.location.href
  const doc = document

  // Do not attempt job scanning, detection, or autofill on Talvyn website routes
  if (isTalvynAppUrl(url)) {
    removePanel()
    discoveryPanelManager.remove()
    autofillCoordinator.dismiss()
    assistantCoordinator.dismiss()
    isSinglePanelVisible = false
    isDiscoveryPanelVisible = false
    return
  }

  const profile = await getUserPreferences()

  // 1. PRIORITY 1: Application Success Confirmation Check (Phase 2D)
  const successResult = await applicationSuccessDetector.checkApplicationSuccess(url, doc)
  if (successResult && successResult.isSuccess) {
    removePanel()
    discoveryPanelManager.remove()
    autofillCoordinator.dismiss()
    assistantCoordinator.dismiss()
    isSinglePanelVisible = false
    isDiscoveryPanelVisible = false
    return
  }

  // 2. PRIORITY 2: Active Job Application Form (Phase 2C Autofill + Phase 2F Application Assistant)
  if (autofillCoordinator.isApplicationFormPage(url, doc)) {
    removePanel()
    discoveryPanelManager.remove()
    isSinglePanelVisible = false
    isDiscoveryPanelVisible = false

    // Cache application session before submission
    const currentJob = detectJob()
    await applicationSessionManager.createOrUpdateSession({
      pageUrl: url,
      jobUrl: currentJob?.jobUrl || url,
      jobTitle: currentJob?.title || undefined,
      company: currentJob?.company || undefined,
      location: currentJob?.location || undefined,
    })

    // Observe submit button clicks on the form
    applicationSuccessDetector.observeFormSubmission()

    // Activate Application Assistant and Progress Tracker (Phase 2F)
    const assistantActivated = await assistantCoordinator.activate(url, doc, profile, currentJob)
    if (assistantActivated) {
      console.log('[Talvyn] Activated Universal Application Assistant on application form.')
      return
    }

    const activated = await autofillCoordinator.activateAutofill(url, doc, profile)
    if (activated) {
      console.log('[Talvyn] Activated Universal Autofill on application form.')
      return
    }
  } else {
    autofillCoordinator.dismiss()
    assistantCoordinator.dismiss()
  }

  // 3. PRIORITY 3: Multi-Job Listing Page (Phase 2B Smart Analyzer)
  const { classification, adapterName } = jobScanner.classifyPage(url, doc)
  console.log(`[Talvyn] Page classified as: ${classification} (Adapter: ${adapterName})`)

  if (classification === 'JOB_LIST') {
    removePanel()
    isSinglePanelVisible = false
    autofillCoordinator.dismiss()

    const summary = jobScanner.scanJobListing(url, doc, profile)

    if (summary.totalDetected > 0) {
      isDiscoveryPanelVisible = true
      discoveryPanelManager.render(summary, {
        onSaveJob: async (analyzed: AnalyzedJob) => {
          const token = await getToken()
          if (!token) {
            alert('Please sign in to Talvyn via the extension popup to save jobs.')
            throw new Error('Not authenticated')
          }
          await jobsService.save({
            title: analyzed.job.title,
            company: analyzed.job.company,
            jobUrl: analyzed.job.jobUrl,
            sourceWebsite: analyzed.job.sourceWebsite,
            location: analyzed.job.location,
            salary: analyzed.job.salary,
            description: analyzed.job.description,
            status: 'SAVED',
          })
          console.log('[Talvyn] Saved job from discovery panel:', analyzed.job.title)
        },
        onDismiss: () => {
          isDiscoveryPanelVisible = false
        },
      })
    } else {
      discoveryPanelManager.remove()
      isDiscoveryPanelVisible = false
    }
    return
  }

  // 4. PRIORITY 4: Single Job Detail Page (Phase 2A Job Saver)
  if (classification === 'SINGLE_JOB') {
    discoveryPanelManager.remove()
    autofillCoordinator.dismiss()
    isDiscoveryPanelVisible = false

    currentSingleJob = jobScanner.scanSingleJob(url, doc) || detectJob()
    if (!currentSingleJob) return

    isSinglePanelVisible = true
    await showSinglePanel(currentSingleJob)
    return
  }

  // Otherwise cleanup
  removePanel()
  discoveryPanelManager.remove()
  autofillCoordinator.dismiss()
  isSinglePanelVisible = false
  isDiscoveryPanelVisible = false
}

async function showSinglePanel(job: ExtractedJob): Promise<void> {
  const token = await getToken()
  const profile = await getUserPreferences()

  // 1. Deterministic Opportunity Classification (Phase 2E)
  const opp = opportunityClassifier.classify(job.title, job.description, job.jobType)

  // 2. Fetch resumes for Application Readiness calculation
  let resumes: Resume[] = []
  if (token) {
    try {
      resumes = await resumesService.list()
    } catch {
      /* fallback */
    }
  }
  const readiness = readinessScorer.calculateReadiness(profile, resumes)

  if (!token) {
    injectPanel(job, () => {}, () => { isSinglePanelVisible = false }, {
      opportunityType: opp.type,
      readiness,
      deadline: opp.deadline,
    })
    updatePanelState({ type: 'logged-out', opportunityType: opp.type })
    return
  }

  try {
    const check = await jobsService.checkDuplicate(job.jobUrl)
    if (check.exists && check.job) {
      injectPanel(job, handleSingleSave, () => { isSinglePanelVisible = false }, {
        opportunityType: opp.type,
        readiness,
        deadline: opp.deadline,
      })

      const status = check.job.status
      if (status === 'APPLIED') {
        updatePanelState({
          type: 'applied',
          existingJobId: check.job.id,
          existingStatus: check.job.status,
          opportunityType: opp.type,
          readiness,
          deadline: opp.deadline,
        })
      } else if (status === 'IN_PROGRESS') {
        updatePanelState({
          type: 'in_progress',
          existingJobId: check.job.id,
          existingStatus: check.job.status,
          opportunityType: opp.type,
          readiness,
          deadline: opp.deadline,
        })
      } else {
        updatePanelState({
          type: 'duplicate',
          existingJobId: check.job.id,
          existingStatus: check.job.status,
          opportunityType: opp.type,
          readiness,
          deadline: opp.deadline,
        })
      }
      return
    }
  } catch {
    /* proceed */
  }

  injectPanel(job, handleSingleSave, () => { isSinglePanelVisible = false }, {
    opportunityType: opp.type,
    readiness,
    deadline: opp.deadline,
  })
}

async function handleSingleSave(): Promise<void> {
  if (!currentSingleJob) return
  updatePanelState({ type: 'loading' })

  const opp = opportunityClassifier.classify(currentSingleJob.title, currentSingleJob.description, currentSingleJob.jobType)

  try {
    const saved = await jobsService.save({
      title: currentSingleJob.title,
      company: currentSingleJob.company,
      jobUrl: currentSingleJob.jobUrl,
      sourceWebsite: currentSingleJob.sourceWebsite,
      location: currentSingleJob.location,
      salary: currentSingleJob.salary,
      description: currentSingleJob.description,
      jobType: opp.type,
      status: 'SAVED',
    })
    updatePanelState({ type: 'saved', opportunityType: opp.type })
    console.log('[Talvyn] Opportunity saved:', saved.id, 'Type:', opp.type)
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to save. Please try again.'
    updatePanelState({ type: 'error', message })
  }
}

// ─── Hardened Startup & SPA Navigation Observer (Phase 2F) ─────────────────

async function init() {
  try {
    document.documentElement.setAttribute('data-talvyn-extension-installed', 'true')
  } catch {
    /* DOM attribute */
  }

  if (document.readyState === 'loading') {
    await new Promise<void>((res) => document.addEventListener('DOMContentLoaded', () => res()))
  }

  await new Promise<void>((res) => setTimeout(res, 500))

  // Initial page evaluation
  await safeAnalyzeAndRender()

  // Initialize hardened SPA navigation & History API observer
  navigationObserver.init(async (_newUrl) => {
    applicationSuccessDetector.resetPageState()
    jobScanner.clearCache()
    removePanel()
    discoveryPanelManager.remove()
    autofillCoordinator.dismiss()
    isSinglePanelVisible = false
    isDiscoveryPanelVisible = false

    await safeAnalyzeAndRender()
  })
}

async function safeAnalyzeAndRender(): Promise<void> {
  try {
    await analyzeAndRenderPage()
  } catch (err) {
    console.error('[Talvyn] Safe execution error during page analysis:', err)
  }
}

init().catch((err) => console.error('[Talvyn] Init failed:', err))

export {}

