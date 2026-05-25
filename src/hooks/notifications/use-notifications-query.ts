import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTripNotifications,
  deleteNotification,
  fetchNotifications,
  markNotificationRead,
} from '@/services/notifications/notification-api';
import type { NotificationRow } from '@/types/database';

export const notificationKeys = {
  all: ['notifications'] as const,
};

export function useNotificationsQuery() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: fetchNotifications,
  });
}

export function useCreateTripNotificationsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTripNotifications,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDismissNotificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previous = queryClient.getQueryData<NotificationRow[]>(notificationKeys.all);
      if (previous) {
        queryClient.setQueryData(
          notificationKeys.all,
          previous.filter((n) => n.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationKeys.all, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
