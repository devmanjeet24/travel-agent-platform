import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { logProfileAvatar } from '@/lib/profile-avatar-log';

const AVATAR_SIZE = 512;

async function resolveDimensions(
  uri: string,
  width: number,
  height: number,
): Promise<{ width: number; height: number }> {
  if (width > 0 && height > 0) return { width, height };

  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (w, h) => resolve({ width: w, height: h }),
      (err) => reject(err ?? new Error('Could not read image dimensions')),
    );
  });
}

/** Center-crop to square and resize for profile avatar upload. */
export async function cropProfileAvatarSquare(params: {
  uri: string;
  width: number;
  height: number;
}): Promise<string> {
  const { width, height } = await resolveDimensions(params.uri, params.width, params.height);
  const side = Math.min(width, height);
  const originX = Math.round((width - side) / 2);
  const originY = Math.round((height - side) / 2);

  const result = await manipulateAsync(
    params.uri,
    [
      { crop: { originX, originY, width: side, height: side } },
      { resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } },
    ],
    { compress: 0.85, format: SaveFormat.JPEG },
  );

  logProfileAvatar('crop:manipulator', {
    input: params.uri,
    output: result.uri,
    width: result.width,
    height: result.height,
  });

  return result.uri;
}
