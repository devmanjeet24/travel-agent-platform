import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchNotifications,
  markNotificationRead,
} from '@/services/notifications/notification-api';

export const notificationKeys = {
  all: ['notifications'] as const,
};

export function useNotificationsQuery() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: fetchNotifications,
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
