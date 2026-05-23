const PREFIX = '[ProfileAvatar]';

export function logProfileAvatar(step: string, detail?: unknown) {
  if (__DEV__) {
    if (detail !== undefined) {
      console.log(PREFIX, step, detail);
    } else {
      console.log(PREFIX, step);
    }
  }
}

export function logProfileAvatarError(step: string, error: unknown) {
  console.error(PREFIX, step, error);
}
