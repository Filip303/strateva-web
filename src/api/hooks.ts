import { useQuery } from '@tanstack/react-query'
import { fetchCorridors } from './client'

/**
 * Available corridors, fetched exclusively from GET /api/v1/corridors.
 * No automatic retries and no background refetching: retrying is a manual
 * user action.
 */
export function useCorridors() {
  return useQuery({
    queryKey: ['corridors'],
    queryFn: fetchCorridors,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
}
