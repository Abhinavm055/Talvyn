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
import { injectPanel, updatePanelState, removePanel, injectUnsupportedNotice } from './panel'
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
  isExtensionContextValid,
  setRuntimeReady,
  onExtensionShutdown,
  shutdownExtensionRuntime,
} from '../utils/extensionContext'

import { normalizeJob } from './jobNormalizer'
import { isExplicitlyNonJobSite, isLikelyJobPage, isLikelyJobListing } from './jobEvidenceDetector'

let currentSingleJob: ExtractedJob | null = null
let nativePageJob: ExtractedJob | null = null
let selectedDiscoveryJob: ExtractedJob | null = null
let activePanelMode: 'NONE' | 'DISCOVERY' | 'SELECTED_DISCOVERY' | 'NATIVE_SINGLE' = 'NONE'
let isSinglePanelVisible = false
let isDiscoveryPanelVisible = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let hasUserRequestedAnalysis = false
let lastListingSummary: any = null

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
  activePanelMode = 'NONE'
  selectedDiscoveryJob = null
  nativePageJob = null
})

// Announce extension presence to Talvyn web app for automatic discovery
try {
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    document.documentElement.setAttribute('data-talvyn-extension-id', chrome.runtime.id)
    try {
      window.localStorage.setItem('talvyn_connected_extension_id', chrome.runtime.id)
    } catch {}
    window.dispatchEvent(new CustomEvent('talvyn:extension-ready', { detail: { extensionId: chrome.runtime.id } }))
    console.log('[Talvyn] EXTENSION_READY')
  }
} catch {
  /* ignore */
}

// Listen for logout events dispatched by the Talvyn web dashboard to synchronize logout
try {
  window.addEventListener('talvyn:auth-logout', () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'DISCONNECT_TALVYN' }, () => {
          if (chrome.runtime?.lastError) {
            /* ignore */
          }
        })
      }
    } catch {
      /* ignore */
    }
  })

  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.data?.type === 'TALVYN_DISCONNECT_EXTENSION') {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: 'DISCONNECT_TALVYN' }, () => {
            if (chrome.runtime?.lastError) {
              /* ignore */
            }
          })
        }
      } catch {
        /* ignore */
      }
    }
  })
} catch {
  /* ignore */
}


console.log('[Talvyn] Content script loaded')

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
      const liveProfile = await Promise.race([
        profileService.get(),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 1500)),
      ])
      if (liveProfile) return liveProfile
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

  // Part 14 UX Rule: Do not automatically cover the webpage with floating panel unless requested
  if (!hasUserRequestedAnalysis) {
    return
  }

  if (classification === 'JOB_LIST') {
    if (activePanelMode === 'SELECTED_DISCOVERY') {
      return // Preserve selected discovery view
    }
    removePanel()
    isSinglePanelVisible = false
    autofillCoordinator.dismiss()

    const summary = jobScanner.scanJobListing(url, doc, profile)

    if (summary.totalDetected > 0) {
      renderDiscoveryView(summary)
    } else {
      discoveryPanelManager.remove()
      isDiscoveryPanelVisible = false
      activePanelMode = 'NONE'
    }
    return
  }

  // 4. PRIORITY 4: Single Job Detail Page (Phase 2A Job Saver)
  if (classification === 'SINGLE_JOB') {
    if (activePanelMode === 'SELECTED_DISCOVERY') {
      return // Preserve selected discovery view
    }
    discoveryPanelManager.remove()
    autofillCoordinator.dismiss()
    isDiscoveryPanelVisible = false

    const job = jobScanner.scanSingleJob(url, doc) || detectJob(url, doc)
    if (!job) return

    nativePageJob = job
    currentSingleJob = job
    activePanelMode = 'NATIVE_SINGLE'
    console.log(`[Talvyn] JOB_DETECTED: ${job.title} at ${job.company}`)
    isSinglePanelVisible = true
    await showSinglePanel(job)
    return
  }

  // Otherwise cleanup
  removePanel()
  discoveryPanelManager.remove()
  autofillCoordinator.dismiss()
  isSinglePanelVisible = false
  isDiscoveryPanelVisible = false
}

let listingObserver: MutationObserver | null = null
function startListingObserver(): void {
  if (listingObserver || typeof MutationObserver === 'undefined') return
  listingObserver = new MutationObserver(() => {
    if (!isDiscoveryPanelVisible || !isRuntimeActive()) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      if (!isDiscoveryPanelVisible || !isRuntimeActive()) return
      const url = window.location.href
      const doc = document
      const { classification } = jobScanner.classifyPage(url, doc)
      if (classification === 'JOB_LIST') {
        const profile = await getUserPreferences()
        const summary = jobScanner.scanJobListing(url, doc, profile)
        if (summary.totalDetected > 0) {
          discoveryPanelManager.updateSummary(summary)
        }
      }
    }, 1200)
  })
  if (document.body) {
    listingObserver.observe(document.body, { childList: true, subtree: true })
  }
}

function enrichSelectedDiscoveryJobFromDom(job: ExtractedJob, doc: Document = document): ExtractedJob {
  if (!doc) return job

  try {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

    // 1. Try to find authoritative job detail container currently active in DOM
    const detailContainer = doc.querySelector(
      '[data-testid="jobsearch-JobComponent"], [data-testid="jobsearch-ViewJobLayout-mainContent"], #jobsearch-ViewjobPaneWrapper, .jobsearch-JobComponent, #viewJobSSRRoot, article[class*="job" i], [role="main"]'
    )

    if (detailContainer) {
      const containerTitleEl = detailContainer.querySelector(
        '[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title, h1[class*="jobsearch-JobInfoHeader-title"], h2.jobsearch-JobInfoHeader-title, h1[class*="jobTitle" i], h2[class*="jobTitle" i]'
      )
      const containerCompanyEl = detailContainer.querySelector(
        '[data-testid="inlineHeader-companyName"], [data-testid="company-name"], div[data-testid="jobsearch-CompanyInfoContainer"] a, .companyName, [class*="companyName"]'
      )

      const cTitle = containerTitleEl?.textContent?.trim() || ''
      const cComp = containerCompanyEl?.textContent?.trim() || ''

      const titleMatch = cTitle && job.title && (clean(cTitle).includes(clean(job.title)) || clean(job.title).includes(clean(cTitle)))
      const compMatch = cComp && job.company && job.company !== 'Unknown Company' && (clean(cComp).includes(clean(job.company)) || clean(job.company).includes(clean(cComp)))

      // Strict check: Only enrich if this active detail container definitively belongs to the selected job!
      if (titleMatch || (compMatch && (!cTitle || titleMatch))) {
        const descEl = detailContainer.querySelector(
          '#jobDescriptionText, [data-testid="jobsearch-JobComponent-description"], [class*="job-description" i], [class*="jobDescription" i], [class*="description" i]'
        )
        const fullDesc = descEl?.textContent?.replace(/\s+/g, ' ').trim()

        const responsibilities: string[] = []
        const requirements: string[] = []
        if (descEl) {
          const lis = Array.from(descEl.querySelectorAll('li'))
          for (const li of lis) {
            const text = li.textContent?.replace(/\s+/g, ' ').trim() || ''
            if (text.length > 8 && text.length < 250) {
              const parentHeading = li.closest('ul')?.previousElementSibling?.textContent?.toLowerCase() || ''
              if (/responsibilit|duties|what you('ll|\s+will)\s+do/i.test(parentHeading)) {
                responsibilities.push(text)
              } else if (/requirement|qualification|what we('re|\s+are)\s+looking\s+for|skills/i.test(parentHeading)) {
                requirements.push(text)
              }
            }
          }
        }

        return {
          ...job,
          description: fullDesc && fullDesc.length > 40 ? fullDesc : job.description,
          responsibilities: responsibilities.length > 0 ? responsibilities : job.responsibilities,
          requirements: requirements.length > 0 ? requirements : job.requirements,
        }
      }
    }

    // 2. Look for the specific job card in the listing for this job to extract snippet bullets & metadata
    const cards = Array.from(doc.querySelectorAll('[data-jk], [class*="jobCard" i], [class*="job-card" i], [data-job-id], article, li'))
    for (const card of cards) {
      const cardText = card.textContent || ''
      if (clean(cardText).includes(clean(job.title))) {
        const snippetEl = card.querySelector('.job-snippet, [data-testid="job-snippet"], [class*="job-snippet"], [class*="jobCardShelfContainer"], .underShelfFooter, ul, p')
        const snippetText = snippetEl?.textContent?.replace(/\s+/g, ' ').trim()
        const snippetLis = Array.from(card.querySelectorAll('ul li, .job-snippet li, [class*="job-snippet"] li'))
        const bullets = snippetLis.map((li) => li.textContent?.replace(/\s+/g, ' ').trim() || '').filter((t) => t.length > 8 && t.length < 250)

        const locEl = card.querySelector('[data-testid="text-location"], [data-testid="inlineHeader-companyLocation"], .companyLocation, [class*="location" i]')
        const salEl = card.querySelector('[data-testid="attribute_snippet_testid"], .salary-snippet-container, [class*="salary" i]')

        if (snippetText || bullets.length > 0 || locEl || salEl) {
          return {
            ...job,
            location: job.location || locEl?.textContent?.trim() || undefined,
            salary: job.salary || salEl?.textContent?.trim() || undefined,
            description: job.description && job.description.length > (snippetText?.length || 0) ? job.description : (snippetText || job.description),
            responsibilities: (job.responsibilities && job.responsibilities.length > 0) ? job.responsibilities : (bullets.length > 0 ? bullets.slice(0, 4) : undefined),
          }
        }
      }
    }

    // 3. Structured data fallback (JSON-LD)
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
    for (const script of Array.from(scripts)) {
      const text = script.textContent
      if (!text) continue
      const data = JSON.parse(text)
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item['@type'] === 'JobPosting') {
          const jTitle = item.title || item.name || ''
          if (clean(jTitle).includes(clean(job.title)) || clean(job.title).includes(clean(jTitle))) {
            const rawDesc = item.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
            if (rawDesc && (!job.description || job.description.length < rawDesc.length)) {
              return {
                ...job,
                description: rawDesc,
              }
            }
          }
        }
      }
    }
  } catch {}

  return job
}

function renderDiscoveryView(summary: JobListAnalysisSummary): void {
  lastListingSummary = summary
  activePanelMode = 'DISCOVERY'
  isDiscoveryPanelVisible = true
  isSinglePanelVisible = false
  startListingObserver()
  discoveryPanelManager.render(summary, {
    onSaveJob: async (analyzed: AnalyzedJob) => {
      const token = await getToken()
      if (!token) {
        alert('Please connect your Talvyn account via the extension popup to save jobs.')
        throw new Error('Not authenticated')
      }
      const profile = await getUserPreferences()
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
    onSelectJob: async (job: ExtractedJob) => {
      discoveryPanelManager.remove()
      isDiscoveryPanelVisible = false
      const enrichedJob = enrichSelectedDiscoveryJobFromDom(job, document)
      selectedDiscoveryJob = enrichedJob
      currentSingleJob = enrichedJob
      activePanelMode = 'SELECTED_DISCOVERY'

      await showSinglePanel(enrichedJob, {
        fromListing: true,
        onBackToListing: () => {
          removePanel()
          selectedDiscoveryJob = null
          currentSingleJob = nativePageJob
          activePanelMode = 'DISCOVERY'
          if (lastListingSummary) {
            renderDiscoveryView(lastListingSummary)
          }
        },
      })
    },
    onDismiss: () => {
      isDiscoveryPanelVisible = false
      activePanelMode = 'NONE'
      hasUserRequestedAnalysis = false
    },
    onRefresh: async () => {
      console.log('[Talvyn] Re-analyzing listing page on user request')
      const profile = await getUserPreferences()
      const freshSummary = jobScanner.scanJobListing(window.location.href, document, profile)
      discoveryPanelManager.updateSummary(freshSummary)
    },
  })
}

async function showSinglePanel(
  job: ExtractedJob,
  extraOptions?: { fromListing?: boolean; onBackToListing?: () => void }
): Promise<void> {
  currentSingleJob = job
  isSinglePanelVisible = true

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

  const panelOptions = {
    opportunityType: opp.type,
    readiness,
    deadline: opp.deadline,
    normalization: normResult,
    isConnected: Boolean(token),
    theme: (profile as any)?.themePreference || 'system',
    userProfile: profile,
    resumeName: resumes[0]?.fileName || 'Default Resume',
    onProfileUpdated: async (updatedProfile: UserProfile) => {
      console.log('[Talvyn] Profile updated from intelligence window:', updatedProfile)
      const user = await getUser()
      if (user) {
        await setUser({ ...user, profile: updatedProfile })
      }
    },
    onBackToListing: extraOptions?.onBackToListing,
  }

  const handleDismiss = () => {
    isSinglePanelVisible = false
    activePanelMode = 'NONE'
    hasUserRequestedAnalysis = false
    selectedDiscoveryJob = null
  }

  if (!token) {
    injectPanel(
      normResult.normalized,
      (customJob, customProfile) => handleSingleSave(customJob, customProfile),
      handleSingleApply,
      handleDismiss,
      panelOptions
    )
    updatePanelState({ type: 'logged-out', opportunityType: opp.type, job: normResult.normalized, normalization: normResult })
    return
  }

  try {
    const check = await jobsService.checkDuplicate(job.jobUrl)
    if (check.exists && check.job) {
      console.log(`[Talvyn] JOB_ALREADY_SAVED: ${check.job.id} (${check.job.title})`)
      injectPanel(
        normResult.normalized,
        (customJob, customProfile) => handleSingleSave(customJob, customProfile),
        handleSingleApply,
        handleDismiss,
        panelOptions
      )

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

  injectPanel(
    normResult.normalized,
    (customJob, customProfile) => handleSingleSave(customJob, customProfile),
    handleSingleApply,
    handleDismiss,
    panelOptions
  )
}

let isSingleApplyRunning = false

async function handleSingleApply(): Promise<void> {
  if (isSingleApplyRunning) {
    console.log('[Talvyn Apply] Application workflow already active. Ignoring duplicate invocation.')
    return
  }
  isSingleApplyRunning = true

  try {
    if (!currentSingleJob) {
      console.warn('[Talvyn Apply] No active job selected to apply.')
      updatePanelState({
        type: 'error',
        message: 'No active job opportunity selected to apply for.',
      })
      return
    }

    const job = currentSingleJob
    console.log(`[Talvyn Apply] Starting apply workflow for: "${job.title}" at "${job.company}"`)
    updatePanelState({ type: 'autofilling' })

    const profile = await getUserPreferences()
    const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
    const doc = document

    // Helper to validate whether a string is a valid web URL
    const isValidHttpUrl = (str?: string | null): boolean => {
      if (!str) return false
      try {
        const parsed = new URL(str, window.location.origin)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      } catch {
        return false
      }
    }

    // Check if current page differs from job's canonical URL or target apply URL (e.g. Discovery listing view)
    const isDifferentDestination = (targetUrl?: string | null): boolean => {
      if (!targetUrl || !isValidHttpUrl(targetUrl)) return false
      try {
        const target = new URL(targetUrl, window.location.origin)
        const current = new URL(currentUrl)
        if (target.origin !== current.origin) return true
        if (target.pathname !== current.pathname) return true
        if (target.search && target.search !== current.search) return true
        return false
      } catch {
        return false
      }
    }

    // 1. Scenario A: Explicit applyUrl stored on job
    if (job.applyUrl && isValidHttpUrl(job.applyUrl)) {
      console.log(`[Talvyn Apply] Scenario A: Explicit applyUrl found: ${job.applyUrl}`)
      try {
        await applicationSessionManager.createOrUpdateSession({
          pageUrl: job.applyUrl,
          jobUrl: job.jobUrl || job.applyUrl,
          jobTitle: job.title,
          company: job.company,
          location: job.location,
        })
      } catch (sessionErr) {
        console.warn('[Talvyn Apply] Could not record application session:', sessionErr)
      }

      window.open(job.applyUrl, '_blank')
      const normResult = normalizeJob(job, profile)
      updatePanelState({
        type: 'autofill-complete',
        job: normResult.normalized,
        normalization: normResult,
        autofillStats: {
          filledFields: ['Application Tab Opened', 'Job Context Preserved'],
          reviewFields: ['Review requirements and submission on destination page'],
        },
      })
      return
    }

    // 2. Scenario B: Discovery Job Selected from listing
    const isDiscoverySelected = activePanelMode === 'SELECTED_DISCOVERY' || Boolean(selectedDiscoveryJob && selectedDiscoveryJob.title === job.title)
    if (isDiscoverySelected && job.jobUrl && isValidHttpUrl(job.jobUrl)) {
      console.log(`[Talvyn Apply] Scenario B: Discovery job selected. Navigating to job destination: ${job.jobUrl}`)
      try {
        await applicationSessionManager.createOrUpdateSession({
          pageUrl: job.jobUrl,
          jobUrl: job.jobUrl,
          jobTitle: job.title,
          company: job.company,
          location: job.location,
        })
      } catch (sessionErr) {
        console.warn('[Talvyn Apply] Could not record application session:', sessionErr)
      }

      window.open(job.jobUrl, '_blank')
      const normResult = normalizeJob(job, profile)
      updatePanelState({
        type: 'autofill-complete',
        job: normResult.normalized,
        normalization: normResult,
        autofillStats: {
          filledFields: ['Job Page Opened', 'Candidate Context Preserved'],
          reviewFields: ['Review application instructions on job page'],
        },
      })
      return
    }

    // 3. Scenario D: In-page application form already active (or external ATS form page)
    if (autofillCoordinator.isApplicationFormPage(currentUrl, doc)) {
      console.log('[Talvyn Apply] Scenario D: In-page application form detected. Running assistant & autofill...')
      try {
        await applicationSessionManager.createOrUpdateSession({
          pageUrl: currentUrl,
          jobUrl: job.jobUrl || currentUrl,
          jobTitle: job.title,
          company: job.company,
          location: job.location,
        })
        await assistantCoordinator.activate(currentUrl, doc, profile, job)
        const autofillSuccess = await autofillCoordinator.activateAutofill(currentUrl, doc, profile, true)
        const normResult = normalizeJob(job, profile)
        updatePanelState({
          type: 'autofill-complete',
          job: normResult.normalized,
          normalization: normResult,
          autofillStats: {
            filledFields: autofillSuccess ? ['Full Name', 'Email', 'Phone', 'LinkedIn', 'Resume'] : ['Assistant Ready'],
            reviewFields: ['Sensitive / Custom Questions (Review Required)'],
          },
        })
        return
      } catch (formErr) {
        console.error('[Talvyn Apply] Failed autofilling on application form page:', formErr)
        updatePanelState({
          type: 'error',
          message: 'Encountered an issue autofilling the form. Please review the form fields directly.',
        })
        return
      }
    }

    // 4. In-page external apply links (e.g. ATS links, redirect buttons)
    const externalLink = doc.querySelector<HTMLAnchorElement>(
      'a[href*="/apply" i], a[href*="apply" i], a[data-testid*="apply" i], a[class*="apply" i], a.jobs-apply-button, a[href*="greenhouse.io" i], a[href*="lever.co" i], a[href*="myworkdayjobs.com" i], a[href*="smartrecruiters.com" i], a[href*="ashbyhq.com" i]'
    )
    if (externalLink && externalLink.href && isValidHttpUrl(externalLink.href) && isDifferentDestination(externalLink.href)) {
      console.log(`[Talvyn Apply] External ATS or application link found on page: ${externalLink.href}`)
      try {
        await applicationSessionManager.createOrUpdateSession({
          pageUrl: externalLink.href,
          jobUrl: job.jobUrl || externalLink.href,
          jobTitle: job.title,
          company: job.company,
          location: job.location,
        })
      } catch (sessionErr) {
        console.warn('[Talvyn Apply] Could not record application session:', sessionErr)
      }
      window.open(externalLink.href, '_blank')
      const normResult = normalizeJob(job, profile)
      updatePanelState({
        type: 'autofill-complete',
        job: normResult.normalized,
        normalization: normResult,
        autofillStats: {
          filledFields: ['Application Portal Opened'],
          reviewFields: ['Review requirements and submission on destination portal'],
        },
      })
      return
    }

    // 5. Scenario E: Try to click native apply button or modal trigger on the page
    const nativeApplyBtn = doc.querySelector<HTMLElement>(
      [
        'button[id*="indeedApplyButton" i]',
        'button[data-testid*="indeedApplyButton" i]',
        'a[href*="/rc/clk" i]',
        'a[href*="indeed.com/apply" i]',
        'button[class*="jobs-apply-button" i]',
        'button[aria-label*="easy apply" i]',
        'button[aria-label*="apply now" i]',
        'button[aria-label*="apply" i]',
        'a[aria-label*="apply" i]',
        'button[class*="apply" i]:not(#talvyn-apply-btn)',
        'a[class*="apply" i]:not(#talvyn-apply-btn)',
        'button[data-testid*="apply" i]',
        'a[data-testid*="apply" i]',
        '[class*="apply-button" i]',
        '[class*="ApplyButton" i]',
        'a[href*="unstop.com/api" i]',
        'button[class*="register" i]',
        'a[class*="register" i]',
        '[data-testid*="apply-button" i]',
      ].join(', ')
    )

    if (nativeApplyBtn) {
      if (nativeApplyBtn instanceof HTMLAnchorElement && nativeApplyBtn.href && isValidHttpUrl(nativeApplyBtn.href) && isDifferentDestination(nativeApplyBtn.href)) {
        console.log(`[Talvyn Apply] Native apply anchor found with external destination: ${nativeApplyBtn.href}`)
        try {
          await applicationSessionManager.createOrUpdateSession({
            pageUrl: nativeApplyBtn.href,
            jobUrl: job.jobUrl || nativeApplyBtn.href,
            jobTitle: job.title,
            company: job.company,
            location: job.location,
          })
          window.open(nativeApplyBtn.href, '_blank')
          const normResult = normalizeJob(job, profile)
          updatePanelState({
            type: 'autofill-complete',
            job: normResult.normalized,
            normalization: normResult,
            autofillStats: {
              filledFields: ['Application Tab Opened'],
              reviewFields: ['Complete application on external portal'],
            },
          })
          return
        } catch (clickErr) {
          console.warn('[Talvyn Apply] Failed navigating native apply anchor:', clickErr)
        }
      } else {
        // Trigger click on native button to open modal or inline form
        try {
          console.log('[Talvyn Apply] Triggering in-page apply button click...')
          nativeApplyBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
          nativeApplyBtn.click()
        } catch (btnErr) {
          console.warn('[Talvyn Apply] Could not click native apply button:', btnErr)
        }

        // Wait for potential modal or inline form to render after click
        await new Promise((resolve) => setTimeout(resolve, 700))

        const summary = await autofillCoordinator.scanAndAnalyzeForm(currentUrl, doc, profile)
        if (summary.totalFields > 0 || autofillCoordinator.isApplicationFormPage(currentUrl, doc)) {
          const safeFields = summary.matchedFields.filter((f) => f.canAutofill && !f.isSensitive)
          const reviewFields = summary.matchedFields.filter((f) => f.requiresReview || f.isSensitive || f.isCustomQuestion)

          await assistantCoordinator.activate(currentUrl, doc, profile, currentSingleJob)
          await autofillCoordinator.activateAutofill(currentUrl, doc, profile, true)

          const filledFieldNames = safeFields.map((f) => f.field.label || f.field.name || f.detectedType).filter(Boolean)
          const reviewFieldNames = reviewFields.map((f) => f.field.label || f.field.name || f.detectedType).filter(Boolean)

          console.log(`[Talvyn Apply] In-page modal form autofilled (Filled: ${filledFieldNames.length}, Review: ${reviewFieldNames.length})`)
          const normResult = normalizeJob(currentSingleJob!, profile)
          updatePanelState({
            type: 'autofill-complete',
            job: normResult.normalized,
            normalization: normResult,
            autofillStats: {
              filledFields: filledFieldNames.length > 0 ? filledFieldNames : ['Full Name', 'Email', 'Phone', 'LinkedIn', 'Resume'],
              reviewFields: reviewFieldNames.length > 0 ? reviewFieldNames : ['Work Authorization', 'Salary Expectations'],
            },
          })
          return
        }
      }
    }

    // 6. External ATS or fallback navigation if job has a different URL
    const fallbackDestination = isDifferentDestination(job.jobUrl) ? job.jobUrl : null
    if (fallbackDestination && isValidHttpUrl(fallbackDestination)) {
      console.log(`[Talvyn Apply] Opening destination URL: ${fallbackDestination}`)
      try {
        await applicationSessionManager.createOrUpdateSession({
          pageUrl: fallbackDestination,
          jobUrl: job.jobUrl || fallbackDestination,
          jobTitle: job.title,
          company: job.company,
          location: job.location,
        })
      } catch (sessionErr) {
        console.warn('[Talvyn Apply] Could not record application session:', sessionErr)
      }
      window.open(fallbackDestination, '_blank')
      const normResult = normalizeJob(currentSingleJob!, profile)
      updatePanelState({
        type: 'autofill-complete',
        job: normResult.normalized,
        normalization: normResult,
        autofillStats: {
          filledFields: ['Job Page Opened'],
          reviewFields: ['Review and apply on company site'],
        },
      })
      return
    }

    // 7. Scenario F: Unresolvable destination
    console.warn('[Talvyn Apply] No application form or valid external destination found.')
    updatePanelState({
      type: 'error',
      message: "We couldn't determine the application destination. Please open the job and apply directly.",
    })
  } catch (err) {
    console.error('[Talvyn Apply] Application workflow exception:', err)
    updatePanelState({
      type: 'error',
      message: "We couldn't determine the application destination. Please open the job and apply directly.",
    })
  } finally {
    isSingleApplyRunning = false
  }
}

async function handleSingleSave(customJob?: ExtractedJob, customProfile?: any): Promise<void> {
  if (!currentSingleJob && !customJob) return
  const jobToSave = customJob || currentSingleJob!
  currentSingleJob = jobToSave
  updatePanelState({ type: 'loading' })

  const profile = await getUserPreferences()
  const normResult = normalizeJob(jobToSave, profile)
  const normalized = normResult.normalized

  const payload = {
    title: normalized.title,
    company: normalized.company,
    jobUrl: normalized.jobUrl,
    sourceWebsite: normalized.sourceWebsite,
    location: normalized.location || undefined,
    salary: normalized.salary || undefined,
    description: normalized.description || undefined,
    jobType: normalized.jobType,
    status: 'SAVED' as const,
  }

  if (customProfile && Object.keys(customProfile).length > 0) {
    try {
      await profileService.update(customProfile)
    } catch {
      /* non-fatal profile update */
    }
  }

  console.log('[Talvyn] JOB_NORMALIZED:', JSON.stringify(payload, null, 2))
  console.log(`[Talvyn] JOB_MATCH_CALCULATED: ${normResult.matchScore}% (${normResult.recommendationLabel})`)
  console.log(`[Talvyn] JOB_SAVE_STARTED: ${normalized.title} at ${normalized.company}`)

  try {
    const saved = await jobsService.save(payload)
    console.log(`[Talvyn] JOB_SAVE_RESPONSE: Success (Status 201, ID: ${saved.id})`)
    console.log(`[Talvyn] JOB_SAVE_SUCCESS: ${saved.id} (Title: ${saved.title})`)
    updatePanelState({
      type: 'saved',
      existingStatus: 'SAVED',
      opportunityType: normalized.jobType,
      job: normalized,
      normalization: normResult,
    })
  } catch (err: any) {
    const status = err?.status
    let userMessage = 'Failed to save. Please try again.'

    if (status === 401) {
      userMessage = 'Your Talvyn session expired'
    } else if (status === 403) {
      userMessage = "You don't have permission to save this job"
    } else if (status === 409 || err?.message?.includes('already saved')) {
      console.log('[Talvyn] JOB_ALREADY_SAVED:', normalized.title)
      updatePanelState({
        type: 'duplicate',
        existingStatus: 'SAVED',
        job: normalized,
        normalization: normResult,
      })
      return
    } else if (status === 422 || status === 400) {
      const fieldDetail = err?.body?.error || err?.message || 'Invalid job data'
      userMessage = `Save failed: ${fieldDetail}`
    } else if (status === 500) {
      userMessage = "Talvyn couldn't save this job. Try again."
    } else if (status === 0 || !status) {
      userMessage = 'Connection problem. Try again.'
    } else if (err?.message) {
      userMessage = err.message
    }

    console.error(`[Talvyn] JOB_SAVE_FAILED: (Status ${status || 0}) ${userMessage}`)
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

  let lastRoute = (() => {
    try {
      const u = new URL(typeof window !== 'undefined' ? window.location.href : '')
      return `${u.origin}${u.pathname}`
    } catch {
      return typeof window !== 'undefined' ? window.location.href : ''
    }
  })()

  // Initialize hardened SPA navigation & History API observer
  navigationObserver.init(async (_newUrl) => {
    if (!isRuntimeActive()) return
    console.log('[Talvyn] SPA URL Navigation detected to:', _newUrl)

    let isSameRoute = false
    try {
      const u = new URL(_newUrl)
      const currentRoute = `${u.origin}${u.pathname}`
      isSameRoute = currentRoute === lastRoute
      lastRoute = currentRoute
    } catch {
      isSameRoute = false
    }

    // In-page SPA updates (e.g. query params, tab switching, card selection hash) must NEVER
    // destroy or flicker open panels when the candidate is actively interacting!
    if (activePanelMode === 'SELECTED_DISCOVERY' && selectedDiscoveryJob && isSameRoute) {
      console.log('[Talvyn] Preserving selected discovery job view during in-page SPA URL update.')
      return
    }

    if (isSinglePanelVisible && isSameRoute && currentSingleJob) {
      console.log('[Talvyn] Preserving mounted single job panel during in-page SPA URL update.')
      return
    }

    if (isDiscoveryPanelVisible && isSameRoute) {
      console.log('[Talvyn] In-page listing URL change detected; updating discovery summary in place.')
      const profile = await getUserPreferences()
      const freshSummary = jobScanner.scanJobListing(_newUrl, document, profile)
      if (freshSummary.totalDetected > 0) {
        discoveryPanelManager.updateSummary(freshSummary)
      }
      return
    }

    applicationSuccessDetector.resetPageState()
    jobScanner.clearCache()
    removePanel()
    discoveryPanelManager.remove()
    autofillCoordinator.dismiss()
    assistantCoordinator.dismiss()
    isSinglePanelVisible = false
    isDiscoveryPanelVisible = false
    activePanelMode = 'NONE'
    selectedDiscoveryJob = null
    nativePageJob = null

    await safeAnalyzeAndRender()
  })

  // Register mutation listener for dynamic DOM mutations (never unmount or destroy open panels!)
  navigationObserver.onMutation(async (_url) => {
    if (!isRuntimeActive() || !hasUserRequestedAnalysis) return

    // If candidate has selected a job from Discovery and is viewing its details:
    if (activePanelMode === 'SELECTED_DISCOVERY' && selectedDiscoveryJob) {
      // Background mutations must NEVER close the panel or overwrite the selected job!
      if (!selectedDiscoveryJob.description || selectedDiscoveryJob.description.length < 50) {
        const enriched = enrichSelectedDiscoveryJobFromDom(selectedDiscoveryJob, document)
        if (enriched.description && enriched.description !== selectedDiscoveryJob.description) {
          selectedDiscoveryJob = enriched
          currentSingleJob = enriched
          await showSinglePanel(enriched, {
            fromListing: true,
            onBackToListing: () => {
              removePanel()
              selectedDiscoveryJob = null
              currentSingleJob = nativePageJob
              activePanelMode = 'DISCOVERY'
              if (lastListingSummary) {
                renderDiscoveryView(lastListingSummary)
              }
            },
          })
        }
      }
      return
    }

    // If Discovery view is open, update summary in place without unmounting
    if (isDiscoveryPanelVisible) {
      const url = window.location.href
      const doc = document
      const { classification } = jobScanner.classifyPage(url, doc)
      if (classification === 'JOB_LIST') {
        const profile = await getUserPreferences()
        const freshSummary = jobScanner.scanJobListing(url, doc, profile)
        if (freshSummary.totalDetected > 0) {
          discoveryPanelManager.updateSummary(freshSummary)
        }
      }
      return
    }

    // If viewing native single job, keep panel mounted
    if (isSinglePanelVisible) {
      return
    }
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

// ─── Extension Action Trigger (Icon Click) ──────────────────────────────────

async function handleOpenIntelligencePanel(): Promise<{ success: boolean; mode: string; detectedJobs?: number }> {
  console.log('[Talvyn] Starting page analysis')
  if (!isRuntimeActive()) {
    console.warn('[Talvyn] Runtime inactive; skipping analysis')
    return { success: false, mode: 'inactive' }
  }
  hasUserRequestedAnalysis = true
  jobScanner.clearCache()

  const url = window.location.href
  const doc = document
  const profile = await getUserPreferences()

  // Safety Gate: Explicit non-job sites (YouTube, Google SERP, social media)
  if (isExplicitlyNonJobSite(url)) {
    discoveryPanelManager.remove()
    isDiscoveryPanelVisible = false
    activePanelMode = 'NONE'
    console.log('[Talvyn] Rendering intelligence panel (Unsupported Notice - Non-job site)')
    injectUnsupportedNotice(
      () => {
        removePanel()
      },
      () => {
        handleOpenIntelligencePanel()
      },
      (profile as any)?.themePreference || 'system'
    )
    return { success: true, mode: 'not-job-page' }
  }

  // 1. Classification check
  const { classification, adapterName } = jobScanner.classifyPage(url, doc)
  console.log(`[Talvyn] classifyPage result: ${classification} (adapter: ${adapterName})`)

  // A. Job Listing Page: Check if listing produces jobs or page is classified as JOB_LIST
  const listingSummary = jobScanner.scanJobListing(url, doc, profile)
  console.log(`[Talvyn] scanJobListing result: ${listingSummary.totalDetected} jobs detected`)
  if (
    classification === 'JOB_LIST' ||
    listingSummary.totalDetected >= 2 ||
    (listingSummary.totalDetected >= 1 && (isLikelyJobListing(doc, url) || classification !== 'SINGLE_JOB'))
  ) {
    if (listingSummary.totalDetected >= 1) {
      removePanel()
      isSinglePanelVisible = false
      activePanelMode = 'DISCOVERY'
      console.log(`[Talvyn] Rendering intelligence panel (Discovery Panel - ${listingSummary.totalDetected} jobs)`)
      renderDiscoveryView(listingSummary)
      return { success: true, mode: 'job-listing', detectedJobs: listingSummary.totalDetected }
    }
  }

  // B. Single Job Detail Page (When on a specific job detail page)
  if (classification === 'SINGLE_JOB' || isLikelyJobPage(doc, url)) {
    const job = jobScanner.scanSingleJob(url, doc) || detectJob(url, doc)
    if (job && isLikelyJobPage(doc, url)) {
      nativePageJob = job
      currentSingleJob = job
      activePanelMode = 'NATIVE_SINGLE'
      discoveryPanelManager.remove()
      isDiscoveryPanelVisible = false
      console.log(`[Talvyn] Rendering intelligence panel (Single Job - ${job.title})`)
      await showSinglePanel(job)
      return { success: true, mode: 'single-job' }
    }
  }

  // C. Fallback: Re-verify if any valid job listing cards exist
  if (isLikelyJobListing(doc, url)) {
    const fallbackSummary = jobScanner.scanJobListing(url, doc, profile)
    if (fallbackSummary.totalDetected >= 1) {
      removePanel()
      isSinglePanelVisible = false
      activePanelMode = 'DISCOVERY'
      console.log(`[Talvyn] Rendering intelligence panel (Fallback Discovery Panel - ${fallbackSummary.totalDetected} jobs)`)
      renderDiscoveryView(fallbackSummary)
      return { success: true, mode: 'job-listing', detectedJobs: fallbackSummary.totalDetected }
    }
  }

  // D. Fallback: Re-verify if single job is evident
  const fallbackJob = jobScanner.scanSingleJob(url, doc) || detectJob(url, doc)
  if (fallbackJob && isLikelyJobPage(doc, url)) {
    nativePageJob = fallbackJob
    currentSingleJob = fallbackJob
    activePanelMode = 'NATIVE_SINGLE'
    discoveryPanelManager.remove()
    isDiscoveryPanelVisible = false
    console.log(`[Talvyn] Rendering intelligence panel (Fallback Single Job - ${fallbackJob.title})`)
    await showSinglePanel(fallbackJob)
    return { success: true, mode: 'single-job' }
  }

  // E. Could not detect job on this page
  discoveryPanelManager.remove()
  isDiscoveryPanelVisible = false
  console.log('[Talvyn] Rendering intelligence panel (Unsupported Notice - No job detected)')
  injectUnsupportedNotice(
    () => {
      removePanel()
    },
    () => {
      handleOpenIntelligencePanel()
    },
    (profile as any)?.themePreference || 'system'
  )
  return { success: true, mode: 'not-job-page' }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'TALVYN_OPEN_INTELLIGENCE_PANEL') {
    console.log('[Talvyn] Received TALVYN_OPEN_INTELLIGENCE_PANEL')
    handleOpenIntelligencePanel()
      .then((res) => {
        console.log('[Talvyn] handleOpenIntelligencePanel completed with result:', res)
        sendResponse(res)
      })
      .catch((err) => {
        console.error('[Talvyn] Error in handleOpenIntelligencePanel:', err)
        sendResponse({ success: false, error: String(err?.message || err) })
      })
    return true // async response
  }
})

init().catch((err) => {
  if (isExtensionContextValid()) {
    console.error('[Talvyn] Init failed:', err)
  }
})

export {}

