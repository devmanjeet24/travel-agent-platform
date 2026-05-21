import { Linking, Pressable, Text, View } from 'react-native';

import {
  demoBaliAttractions,
  type TripAttraction,
} from '@/constants/trip-attractions';
import {
  mapsNavigationUrl,
} from '@/services/osrm.service';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type Props = {
  attractions?: TripAttraction[];
};

/** Web fallback — react-native-maps is native-only; link out to OpenStreetMap. */
export function TripMap({ attractions = demoBaliAttractions }: Props) {
  const theme = useThemedStyles();
  const center = attractions[0]?.coordinate;

  const openOverview = () => {
    if (!center) return;
    void Linking.openURL(
      mapsNavigationUrl(center.latitude, center.longitude),
    );
  };

  return (
    <View className="mb-4">
      <Pressable
        onPress={openOverview}
        className={`${theme.bgMuted} rounded-2xl h-48 items-center justify-center mb-3`}
      >
        <Text className={`${theme.text} font-semibold`}>View on OpenStreetMap</Text>
        <Text className={`${theme.textMuted} text-sm mt-2 text-center px-6`}>
          Interactive map runs on iOS and Android. Tap to open the web map.
        </Text>
      </Pressable>
      <Text className={`${theme.textMuted} text-xs`}>
        © OpenStreetMap contributors
      </Text>
    </View>
  );
}

export function AttractionRow({
  attraction,
  onNavigate,
}: {
  attraction: TripAttraction;
  onNavigate?: () => void;
}) {
  const theme = useThemedStyles();

  return (
    <Pressable
      onPress={onNavigate}
      className={`${theme.bgCard} rounded-2xl p-4 mb-3 border ${theme.border}`}
    >
      <Text className={`${theme.text} font-semibold`}>{attraction.title}</Text>
      <Text className={`${theme.textMuted} text-sm mt-1`}>
        {attraction.subtitle}
      </Text>
      <Text className="text-yellow-600 text-sm mt-2 font-medium">
        Open in map →
      </Text>
    </Pressable>
  );
}

export function openAttractionInMaps(attraction: TripAttraction) {
  const { latitude, longitude } = attraction.coordinate;
  void Linking.openURL(mapsNavigationUrl(latitude, longitude));
}

export default TripMap;
