/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TransformState } from '../types';

export function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function computeAutoThreshold(data: Uint8ClampedArray): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = getLuminance(data[i], data[i + 1], data[i + 2]);
    sum += l;
    count++;
  }
  return count > 0 ? sum / count : 128;
}

/**
 * Renders the image with transformations into a buffer that matches the layout size.
 */
export function prepareMaskBuffer(
  image: HTMLImageElement,
  width: number,
  height: number,
  transform: TransformState
): { data: Uint8ClampedArray; w: number; h: number } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) return { data: new Uint8ClampedArray(0), w: 0, h: 0 };

  ctx.save();
  // Move to center to apply rotation and scale consistently
  ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.scale(transform.scale, transform.scale);
  
  // Draw image centered at the translated origin
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();

  const imageData = ctx.getImageData(0, 0, width, height);
  return { data: imageData.data, w: width, h: height };
}
