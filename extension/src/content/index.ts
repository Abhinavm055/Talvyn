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
import { successNotificationManager } from './applicationDetection/successNotification'
import { navigationObserver } from './navigationObserver'
import { opportunityClassifier } from '../opportunityDetection/opportunityClassifier'
import { readinessScorer } from '../services/readinessScorer'
import { resumesService } from '../services/resumesService'
import { getToken, getUser, setToken, setUser, clearAuth } from '../utils/storage'
import { jobsService } from '../services/jobsService'
import { profileService } from '../services/profileService'
import { ExtractedJob, UserProfile, AnalyzedJob, Resume } from '../types'
import {
  isRuntimeActive,
  setRuntimeReady,
  onExtensionShutdown,
  shutdownExtensionRuntime,
} from '../utils/extensionContext'

import { normalizeJob } from './jobNormalizer'

let currentSingleJob: ExtractedJob | null = null
let isSinglePanelVisible = false
let isDiscoveryPanelVisible = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Register shutdown cleanup handler for terminal invalidation
onExtensionShutdown(() => {
  removePanel()
  discoveryPanelManager.remove()
  autofillCoordinator.dismiss()
  assistantCoordinator.dismiss()
  try {
    successNotificationManager.remove()
  } catch {}
  isSinglePanelVisible = false
  isDiscoveryPanelVisible = false
})

// Announce extension presence to Talvyn web app for automatic discovery
try {
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    document.documentElement.setAttribute('data-talvyn-extension-id', chrome.runtime.id)
    window.dispatchEvent(new CustomEvent('talvyn:extension-ready', { detail: { extensionId: chrome.runtime.id } }))
    console.log('[Talvyn] EXTENSION_READY')
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
  if (!isRuntimeActive()) return

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

  // Pre-classify page: if classified as OTHER, perform minimal work and exit early
  const { classification, adapterName } = jobScanner.classifyPage(url, doc)

  if (classification === 'OTHER') {
    removePanel()
    discoveryPanelManager.remove()
    autofillCoordinator.dismiss()
    assistantCoordinator.dismiss()
    isSinglePanelVisible = false
    isDiscoveryPanelVisible = false
    return
  }

  if (!isRuntimeActive()) return
  const profile = await getUserPreferences()
  if (!isRuntimeActive()) return

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
            alert('Please connect your Talvyn account via the extension popup to save jobs.')
            throw new Error('Not authenticated')
          }
          const normResult = normalizeJob(analyzed.job, profile)
          const normalized = normResult.normalized
          console.log(`[Talvyn] JOB_SAVE_STARTED: ${normalized.title} at ${normalized.company}`)
          const saved = await jobsService.save({
            title: normalized.title,
            company: normalized.company,
            jobUrl: normalized.jobUrl,
            sourceWebsite: normalized.sourceWebsite,
            location: normalized.location || undefined,
            salary: normalized.salary || undefined,
            description: normalized.description || undefined,
            jobType: normalized.jobType,
            status: 'SAVED',
          })
          console.log(`[Talvyn] JOB_SAVE_SUCCESS: ${saved.id} (Title: ${saved.title})`)
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

    console.log(`[Talvyn] JOB_DETECTED: ${currentSingleJob.title} at ${currentSingleJob.company}`)
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

  // 1. Normalize job and evaluate match score with profile
  const normResult = normalizeJob(job, profile)
  console.log(`[Talvyn] JOB_NORMALIZED: ${normResult.normalized.title} (Match: ${normResult.matchScore}%, Completeness: ${normResult.completeness}%)`)

  // 2. Deterministic Opportunity Classification (Phase 2E)
  const opp = opportunityClassifier.classify(job.title, job.description, job.jobType)

  // 3. Fetch resumes for Application Readiness calculation
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
    injectPanel(normResult.normalized, () => {}, () => { isSinglePanelVisible = false }, {
      opportunityType: opp.type,
      readiness,
      deadline: opp.deadline,
      normalization: normResult,
      isConnected: false,
    })
    updatePanelState({ type: 'logged-out', opportunityType: opp.type, job: normResult.normalized, normalization: normResult })
    return
  }

  try {
    const check = await jobsService.checkDuplicate(job.jobUrl)
    if (check.exists && check.job) {
      console.log(`[Talvyn] JOB_ALREADY_SAVED: ${check.job.id} (${check.job.title})`)
      injectPanel(normResult.normalized, handleSingleSave, () => { isSinglePanelVisible = false }, {
        opportunityType: opp.type,
        readiness,
        deadline: opp.deadline,
        normalization: normResult,
        isConnected: true,
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
          job: normResult.normalized,
          normalization: normResult,
        })
      } else if (status === 'IN_PROGRESS') {
        updatePanelState({
          type: 'in_progress',
          existingJobId: check.job.id,
          existingStatus: check.job.status,
          opportunityType: opp.type,
          readiness,
          deadline: opp.deadline,
          job: normResult.normalized,
          normalization: normResult,
        })
      } else {
        updatePanelState({
          type: 'duplicate',
          existingJobId: check.job.id,
          existingStatus: check.job.status,
          opportunityType: opp.type,
          readiness,
          deadline: opp.deadline,
          job: normResult.normalized,
          normalization: normResult,
        })
      }
      return
    }
  } catch {
    /* proceed */
  }

  injectPanel(normResult.normalized, handleSingleSave, () => { isSinglePanelVisible = false }, {
    opportunityType: opp.type,
    readiness,
    deadline: opp.deadline,
    normalization: normResult,
    isConnected: true,
  })
}

async function handleSingleSave(): Promise<void> {
  if (!currentSingleJob) return
  updatePanelState({ type: 'loading' })

  const profile = await getUserPreferences()
  const normResult = normalizeJob(currentSingleJob, profile)
  const normalized = normResult.normalized

  console.log(`[Talvyn] JOB_SAVE_STARTED: ${normalized.title} at ${normalized.company}`)

  const opp = opportunityClassifier.classify(normalized.title, normalized.description || '', normalized.jobType)

  try {
    const saved = await jobsService.save({
      title: normalized.title,
      company: normalized.company,
      jobUrl: normalized.jobUrl,
      sourceWebsite: normalized.sourceWebsite,
      location: normalized.location || undefined,
      salary: normalized.salary || undefined,
      description: normalized.description || undefined,
      jobType: opp.type,
      status: 'SAVED',
    })
    updatePanelState({
      type: 'saved',
      opportunityType: opp.type,
      job: normalized,
      normalization: normResult,
    })
    console.log(`[Talvyn] JOB_SAVE_SUCCESS: ${saved.id} (Title: ${saved.title})`)
  } catch (err: any) {
    const status = err?.status
    let userMessage = 'Failed to save. Please try again.'

    if (status === 401) {
      userMessage = 'Your Talvyn session expired. Please reconnect your account.'
    } else if (status === 403) {
      userMessage = "You don't have permission to save this job."
    } else if (status === 409 || err?.message?.includes('already saved')) {
      console.log('[Talvyn] JOB_ALREADY_SAVED:', normalized.title)
      updatePanelState({
        type: 'duplicate',
        existingStatus: 'SAVED',
        job: normalized,
        normalization: normResult,
      })
      return
    } else if (status === 422) {
      userMessage = err?.message || 'Missing required job information.'
    } else if (status === 500) {
      userMessage = "Talvyn couldn't save this job. Try again."
    } else if (status === 0 || !status) {
      userMessage = 'Connection problem. Your job will retry when online.'
    } else if (err?.message) {
      userMessage = err.message
    }

    console.error(`[Talvyn:TALVYN_BACKEND] JOB_SAVE_FAILED: (Status ${status || 0}) ${userMessage}`)
    updatePanelState({
      type: 'error',
      message: userMessage,
      job: normalized,
      normalization: normResult,
    })
  }
}

// ─── Hardened Startup & SPA Navigation Observer (Phase 2F) ─────────────────

async function init() {
  if (!isRuntimeActive()) return

  try {
    document.documentElement.setAttribute('data-talvyn-extension-installed', 'true')
  } catch {
    /* DOM attribute */
  }

  if (document.readyState === 'loading') {
    await new Promise<void>((res) => document.addEventListener('DOMContentLoaded', () => res()))
  }

  if (!isRuntimeActive()) return
  await new Promise<void>((res) => setTimeout(res, 500))
  if (!isRuntimeActive()) return

  // Mark runtime as READY
  setRuntimeReady()

  // Initial page evaluation
  await safeAnalyzeAndRender()

  // Initialize hardened SPA navigation & History API observer
  navigationObserver.init(async (_newUrl) => {
    if (!isRuntimeActive()) return
    applicationSuccessDetector.resetPageState()
    jobScanner.clearCache()
    removePanel()
    discoveryPanelManager.remove()
    autofillCoordinator.dismiss()
    assistantCoordinator.dismiss()
    isSinglePanelVisible = false
    isDiscoveryPanelVisible = false

    await safeAnalyzeAndRender()
  })
}

async function safeAnalyzeAndRender(): Promise<void> {
  if (!isRuntimeActive()) return
  try {
    await analyzeAndRenderPage()
  } catch (err) {
    if (isExtensionContextValid()) {
      console.error('[Talvyn] Safe execution error during page analysis:', err)
    }
  }
}

init().catch((err) => {
  if (isExtensionContextValid()) {
    console.error('[Talvyn] Init failed:', err)
  }
})

export {}

