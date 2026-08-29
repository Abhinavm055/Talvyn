/**
 * Talvyn Languages Taxonomy
 */

export interface LanguageOption {
  name: string
  nativeName?: string
  category: 'Indian' | 'Global'
}

export const LANGUAGES: LanguageOption[] = [
  // Global Major Languages
  { name: 'English', nativeName: 'English', category: 'Global' },
  { name: 'Spanish', nativeName: 'Español', category: 'Global' },
  { name: 'French', nativeName: 'Français', category: 'Global' },
  { name: 'German', nativeName: 'Deutsch', category: 'Global' },
  { name: 'Mandarin Chinese', nativeName: '中文', category: 'Global' },
  { name: 'Japanese', nativeName: '日本語', category: 'Global' },
  { name: 'Arabic', nativeName: 'العربية', category: 'Global' },
  { name: 'Portuguese', nativeName: 'Português', category: 'Global' },
  { name: 'Russian', nativeName: 'Русский', category: 'Global' },
  { name: 'Italian', nativeName: 'Italiano', category: 'Global' },
  { name: 'Korean', nativeName: '한국어', category: 'Global' },
  { name: 'Dutch', nativeName: 'Nederlands', category: 'Global' },

  // Indian Languages
  { name: 'Hindi', nativeName: 'हिन्दी', category: 'Indian' },
  { name: 'Tamil', nativeName: 'தமிழ்', category: 'Indian' },
  { name: 'Telugu', nativeName: 'తెలుగు', category: 'Indian' },
  { name: 'Malayalam', nativeName: 'മലയാളം', category: 'Indian' },
  { name: 'Kannada', nativeName: 'ಕನ್ನಡ', category: 'Indian' },
  { name: 'Bengali', nativeName: 'বাংলা', category: 'Indian' },
  { name: 'Marathi', nativeName: 'मराठी', category: 'Indian' },
  { name: 'Gujarati', nativeName: 'ગુજરાતી', category: 'Indian' },
  { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', category: 'Indian' },
  { name: 'Odia', nativeName: 'ଓଡ଼ିଆ', category: 'Indian' },
  { name: 'Urdu', nativeName: 'اردو', category: 'Indian' },
  { name: 'Assamese', nativeName: 'অসমীয়া', category: 'Indian' },
]

export function searchLanguages(query: string): LanguageOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return LANGUAGES

  return LANGUAGES.filter(
    (l) => l.name.toLowerCase().includes(q) || (l.nativeName && l.nativeName.toLowerCase().includes(q))
  )
}
