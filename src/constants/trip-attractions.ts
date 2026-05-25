import type { LatLng } from '@/services/osrm.service';

export type TripAttraction = {
  id: string;
  title: string;
  subtitle: string;
  coordinate: LatLng;
};
