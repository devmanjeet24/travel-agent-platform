import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { searchCitySuggestions } from '@/services/travel/travel-api';

const DEBOUNCE_MS = 400;

export const citySuggestionKeys = {
  all: ['city-suggestions'] as const,
  query: (q: string) => [...citySuggestionKeys.all, q] as const,
};

export function useCitySuggestions(query: string, enabled: boolean) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const trimmed = debounced.trim();

  return useQuery({
    queryKey: citySuggestionKeys.query(trimmed),
    queryFn: () => searchCitySuggestions(trimmed),
    enabled: enabled && trimmed.length >= 2,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
