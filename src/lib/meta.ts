/**
 * Per-page metadata, applied at runtime without any dependency.
 *
 * Titles, descriptions, canonical URLs (under https://strateva.ai), Open
 * Graph and Twitter Card tags update on every SPA navigation; the 404 page
 * additionally carries robots noindex. The document language stays "en".
 */

export const CANONICAL_ORIGIN = 'https://strateva.ai'
export const SITE_NAME = 'Strateva Payment Router'
export const OG_IMAGE_PATH = '/og-image.png'

export interface PageMeta {
  path: string
  title: string
  description: string
  noindex?: boolean
}

const DEFAULT_DESCRIPTION =
  'Strateva Payment Router is a public simulation lab for international payment routing. Simulation only: it does not execute, custody or transmit funds.'

export const PAGE_META: readonly PageMeta[] = [
  {
    path: '/',
    title: 'Strateva Payment Router — Simulation Lab',
    description: DEFAULT_DESCRIPTION,
  },
  {
    path: '/simulator',
    title: 'Simulator — Strateva Payment Router',
    description:
      'Compare simulated international payment routes by cost, time and reliability. Simulation only: no money moves.',
  },
  {
    path: '/how-it-works',
    title: 'How it works — Strateva Payment Router',
    description:
      'How the Strateva simulation models payment infrastructures as a graph and compares simulated routes end to end.',
  },
  {
    path: '/corridors',
    title: 'Corridors — Strateva Payment Router',
    description:
      'The origin-and-destination pairs the Strateva simulation can model, loaded live from the public API.',
  },
  {
    path: '/methodology',
    title: 'Methodology — Strateva Payment Router',
    description:
      'How to read the simulated figures: total cost, effective FX rate, expected and conservative times, fiat availability and latency provenance.',
  },
  {
    path: '/about',
    title: 'About — Strateva Payment Router',
    description:
      'Strateva Payment Router is an experimental, portfolio-grade public laboratory. It is not a financial service and moves no money.',
  },
  {
    path: '/legal/legal-notice',
    title: 'Legal notice — Strateva Payment Router',
    description:
      'Legal notice for the Strateva Payment Router simulation lab: not a financial service, no payments, no custody.',
  },
  {
    path: '/legal/privacy',
    title: 'Privacy — Strateva Payment Router',
    description:
      'Privacy information for the Strateva Payment Router simulation lab: no sign-up, no stored amounts, no cookies, no tracking.',
  },
  {
    path: '/legal/cookies',
    title: 'Cookies — Strateva Payment Router',
    description:
      'Cookie information for the Strateva Payment Router simulation lab: this website currently uses no cookies at all.',
  },
]

export const NOT_FOUND_META: PageMeta = {
  path: '/404',
  title: 'Page not found — Strateva Payment Router',
  description: 'The page you asked for does not exist on this simulation lab.',
  noindex: true,
}

export function metaForPath(pathname: string): PageMeta {
  return PAGE_META.find((page) => page.path === pathname) ?? NOT_FOUND_META
}

function upsertMetaByName(name: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  )
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function upsertMetaByProperty(property: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  )
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('property', property)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function removeMetaByName(name: string): void {
  document.head.querySelector(`meta[name="${name}"]`)?.remove()
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  )
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

/** Apply a page's metadata to the document head. */
export function applyMeta(pathname: string): PageMeta {
  const meta = metaForPath(pathname)
  const canonicalUrl = `${CANONICAL_ORIGIN}${meta.noindex ? pathname : meta.path}`

  document.documentElement.setAttribute('lang', 'en')
  document.title = meta.title
  upsertMetaByName('description', meta.description)
  upsertCanonical(canonicalUrl)

  upsertMetaByProperty('og:site_name', SITE_NAME)
  upsertMetaByProperty('og:type', 'website')
  upsertMetaByProperty('og:title', meta.title)
  upsertMetaByProperty('og:description', meta.description)
  upsertMetaByProperty('og:url', canonicalUrl)
  upsertMetaByProperty('og:image', `${CANONICAL_ORIGIN}${OG_IMAGE_PATH}`)

  upsertMetaByName('twitter:card', 'summary_large_image')
  upsertMetaByName('twitter:title', meta.title)
  upsertMetaByName('twitter:description', meta.description)
  upsertMetaByName('twitter:image', `${CANONICAL_ORIGIN}${OG_IMAGE_PATH}`)

  if (meta.noindex) {
    upsertMetaByName('robots', 'noindex')
  } else {
    removeMetaByName('robots')
  }
  return meta
}
