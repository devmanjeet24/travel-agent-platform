import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { useDeleteTripMutation } from '@/hooks/trips/use-delete-trip-mutation';

type Options = {
  tripId: string;
  tripTitle: string;
  /** Called after successful delete (default: go to Saved trips tab). */
  onDeleted?: () => void;
};

export function useConfirmDeleteTrip() {
  const router = useRouter();
  const deleteMutation = useDeleteTripMutation();

  const confirmDelete = ({ tripId, tripTitle, onDeleted }: Options) => {
    Alert.alert(
      'Delete trip?',
      `"${tripTitle}" and its itinerary, budget, and packing data will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(tripId, {
              onSuccess: () => {
                Alert.alert('Trip deleted', 'Your saved trip was removed.');
                if (onDeleted) {
                  onDeleted();
                } else {
                  router.replace('/(tabs)/trips' as never);
                }
              },
              onError: (e) => {
                Alert.alert(
                  'Delete failed',
                  e instanceof Error ? e.message : 'Could not delete trip',
                );
              },
            });
          },
        },
      ],
    );
  };

  return { confirmDelete, isDeleting: deleteMutation.isPending };
}
