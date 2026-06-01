import { useEffect, useRef } from 'react';

import { useProfileQuery } from '@/hooks/profile/use-profile-query';
import { useAuth } from '@/providers/auth-provider';
import {
  disablePushNotificationsForUser,
  enablePushNotificationsForUser,
} from '@/services/push/push-registration-service';

/**
 * Keeps Expo push token registration aligned with profile.push_notifications_enabled.
 */
export function usePushNotificationsBootstrap() {
  const { user } = useAuth();
  const { data: profile } = useProfileQuery();
  const lastApplied = useRef<boolean | null>(null);

  useEffect(() => {
    if (!user?.id || profile === undefined) return;

    const enabled = profile?.push_notifications_enabled ?? true;
    if (lastApplied.current === enabled) return;
    lastApplied.current = enabled;

    void (async () => {
      try {
        if (enabled) {
          await enablePushNotificationsForUser(user.id);
        } else {
          await disablePushNotificationsForUser(user.id);
        }
      } catch (e) {
        console.warn('[push-bootstrap]', e instanceof Error ? e.message : e);
      }
    })();
  }, [user?.id, profile?.push_notifications_enabled, profile]);
}
