/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CharacterInfo } from '../types';

export interface LayoutOptions {
  width: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  fontSize: number;
  lineHeight: number;
  charsPerLine: number;
  indent: number;
}

export function computeLayout(
  text: string,
  ctx: CanvasRenderingContext2D,
  options: LayoutOptions
): CharacterInfo[] {
  const {
    width,
    height,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    fontSize,
    lineHeight,
    indent,
  } = options;

  const contentWidth = width - marginLeft - marginRight;
  const contentHeight = height - marginTop - marginBottom;

  ctx.font = `${fontSize}px serif`;
  
  const paragraphs = text.split(/\n+/);
  const result: CharacterInfo[] = [];
  
  let currentY = marginTop + fontSize;
  let lineIndex = 0;

  for (const p of paragraphs) {
    if (currentY > height - marginBottom) break;

    const words = p.trim().split(/\s+/);
    if (words.length === 0) continue;

    let currentLine: string[] = [];
    let currentLineWidth = indent; // Initial indent for paragraphs

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWidth = ctx.measureText(word + ' ').width;

      if (currentLineWidth + wordWidth > contentWidth && currentLine.length > 0) {
        // Justify and commit line
        result.push(...justifyLine(currentLine, currentY, marginLeft + (lineIndex === 0 ? indent : 0), contentWidth - (lineIndex === 0 ? indent : 0), ctx, false, lineIndex));
        currentY += lineHeight;
        currentLine = [word];
        currentLineWidth = ctx.measureText(word + ' ').width;
        lineIndex++;
      } else {
        currentLine.push(word);
        currentLineWidth += wordWidth;
      }

      if (currentY > height - marginBottom) break;
    }

    // Last line of paragraph (left aligned)
    if (currentLine.length > 0 && currentY <= height - marginBottom) {
      result.push(...justifyLine(currentLine, currentY, marginLeft + (lineIndex === 0 ? indent : 0), contentWidth - (lineIndex === 0 ? indent : 0), ctx, true, lineIndex));
      currentY += lineHeight;
      lineIndex = 0; // Reset line index for next paragraph to apply indent
    }
    
    // Extra spacing between paragraphs
    currentY += lineHeight * 0.2;
  }

  return result;
}

function justifyLine(
  words: string[],
  y: number,
  startX: number,
  availableWidth: number,
  ctx: CanvasRenderingContext2D,
  isLastLine: boolean,
  lineIdx: number
): CharacterInfo[] {
  const lineChars: CharacterInfo[] = [];
  
  if (words.length === 1 || isLastLine) {
    let currentX = startX;
    for (const word of words) {
      for (const char of word) {
        lineChars.push({ char, x: currentX, y, lineIndex: lineIdx });
        currentX += ctx.measureText(char).width;
      }
      currentX += ctx.measureText(' ').width;
    }
    return lineChars;
  }

  const totalWordsWidth = words.reduce((acc, w) => acc + ctx.measureText(w).width, 0);
  const totalSpaceNeeded = availableWidth - totalWordsWidth;
  const spaceWidth = totalSpaceNeeded / (words.length - 1);

  let currentX = startX;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (const char of word) {
      lineChars.push({ char, x: currentX, y, lineIndex: lineIdx });
      currentX += ctx.measureText(char).width;
    }
    if (i < words.length - 1) {
      currentX += spaceWidth;
    }
  }

  return lineChars;
}
