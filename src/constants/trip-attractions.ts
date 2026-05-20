import type { LatLng } from '@/services/osrm.service';

export type TripAttraction = {
  id: string;
  title: string;
  subtitle: string;
  coordinate: LatLng;
};

/** Demo Bali attractions — replace with Supabase trip data later. */
export const demoBaliAttractions: TripAttraction[] = [
  {
    id: 'seminyak',
    title: 'Seminyak Beach',
    subtitle: 'Beach · Near hotel',
    coordinate: { latitude: -8.6914, longitude: 115.1682 },
  },
  {
    id: 'tegallalang',
    title: 'Tegallalang Rice Terrace',
    subtitle: 'Ubud · Cultural site',
    coordinate: { latitude: -8.4312, longitude: 115.2798 },
  },
  {
    id: 'tanah-lot',
    title: 'Tanah Lot Temple',
    subtitle: 'Tabanan · Sunset spot',
    coordinate: { latitude: -8.6211, longitude: 115.0868 },
  },
];

export const demoMapRegion = {
  latitude: -8.58,
  longitude: 115.18,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};
