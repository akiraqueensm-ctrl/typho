/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RenderingMode = 'black-white' | 'white-black' | 'grayscale' | 'dramatic-red';

export interface TransformState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface CharacterInfo {
  char: string;
  x: number;
  y: number;
  lineIndex: number;
  fontSize?: number;
}

export interface AppState {
  text: string;
  image: HTMLImageElement | null;
  maskData: Uint8ClampedArray | null;
  maskWidth: number;
  maskHeight: number;
  transform: TransformState;
  threshold: number;
  backgroundOpacity: number;
  mode: RenderingMode;
  debugMode: boolean;
  autoThreshold: boolean;
  noiseIntensity: number;
  invertMask: boolean;
  fontSize: number;
}

export const DEFAULT_TEXT = `# The End of Thunder

It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair, we had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way—in short, the period was so far like the present period, that some of its noisiest authorities insisted on its being received, for good or for evil, in the superlative degree of comparison only.
`;
