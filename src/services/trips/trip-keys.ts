export const tripKeys = {
  all: ['trips'] as const,
  list: () => [...tripKeys.all, 'list'] as const,
  detail: (id: string) => [...tripKeys.all, 'detail', id] as const,
  itinerary: (id: string) => [...tripKeys.all, 'itinerary', id] as const,
  budget: (id: string) => [...tripKeys.all, 'budget', id] as const,
  hotels: (id: string) => [...tripKeys.all, 'hotels', id] as const,
  flights: (id: string) => [...tripKeys.all, 'flights', id] as const,
  packing: (id: string) => [...tripKeys.all, 'packing', id] as const,
};
