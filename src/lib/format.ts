import type { CorridorInfo } from '../api/schemas'

/** Visible corridor label composed ONLY from the codes the API returned. */
export function corridorLabel(corridor: CorridorInfo): string {
  return `${corridor.source_currency} (${corridor.origin_country}) → ${corridor.destination_currency} (${corridor.destination_country})`
}

/** Render integer seconds with an exact human-readable approximation.
 * Pure unit conversion — never recalculates or invents figures. */
export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds} s`
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const approx = hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`
  return `${totalSeconds} s (~${approx})`
}
