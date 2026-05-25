import { env } from '@/lib/env';

type LatLon = { latitude: number; longitude: number };

export type OsmTile = {
  key: string;
  url: string;
  left: number;
  top: number;
  size: number;
  x: number;
  y: number;
  zoom: number;
};

function wrapTileX(x: number, zoom: number): number {
  const max = 2 ** zoom;
  return ((x % max) + max) % max;
}

function clampTileY(y: number, zoom: number): number {
  const max = 2 ** zoom - 1;
  return Math.min(max, Math.max(0, y));
}

function webMercatorPixel(
  coordinate: LatLon,
  zoom: number,
  tileSize: number,
): { x: number; y: number } {
  const scale = tileSize * 2 ** zoom;
  const latitude = Math.max(
    -85.05112878,
    Math.min(85.05112878, coordinate.latitude),
  );
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);

  return {
    x: ((coordinate.longitude + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
      scale,
  };
}

function osmTileUrl(zoom: number, x: number, y: number): string {
  return env.mapTileUrl
    .replace(/\{z\}/g, String(zoom))
    .replace(/\{x\}/g, String(x))
    .replace(/\{y\}/g, String(y));
}

export function buildOsmTileLayout(params: {
  center: LatLon;
  zoom: number;
  width: number;
  height: number;
  tileSize?: number;
}): OsmTile[] {
  const tileSize = params.tileSize ?? 256;
  const centerPixel = webMercatorPixel(params.center, params.zoom, tileSize);
  const topLeft = {
    x: centerPixel.x - params.width / 2,
    y: centerPixel.y - params.height / 2,
  };
  const startX = Math.floor(topLeft.x / tileSize);
  const endX = Math.floor((topLeft.x + params.width) / tileSize);
  const startY = Math.floor(topLeft.y / tileSize);
  const endY = Math.floor((topLeft.y + params.height) / tileSize);
  const tiles: OsmTile[] = [];

  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      const wrappedX = wrapTileX(x, params.zoom);
      const clampedY = clampTileY(y, params.zoom);
      tiles.push({
        key: `${params.zoom}/${wrappedX}/${clampedY}/${x}/${y}`,
        url: osmTileUrl(params.zoom, wrappedX, clampedY),
        left: x * tileSize - topLeft.x,
        top: y * tileSize - topLeft.y,
        size: tileSize,
        x: wrappedX,
        y: clampedY,
        zoom: params.zoom,
      });
    }
  }

  return tiles;
}
