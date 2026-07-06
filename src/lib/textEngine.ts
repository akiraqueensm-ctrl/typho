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
  ctx.font = `${fontSize}px serif`;
  
  const paragraphs = text.split(/\n/);
  const result: CharacterInfo[] = [];
  
  let currentY = marginTop + fontSize;

  for (const p of paragraphs) {
    if (p.trim() === '') {
      currentY += lineHeight * 0.5;
      continue;
    }
    if (currentY > height - marginBottom) break;

    let alignment: 'left' | 'center' | 'right' | 'justify' = 'justify';
    let rawText = p.trim();
    let isTitle = false;
    let localFontSize = fontSize;
    let localLineHeight = lineHeight;
    let isDropCap = false;

    // Directives
    if (rawText.startsWith('# ')) {
      isTitle = true;
      alignment = 'center';
      rawText = rawText.substring(2).toUpperCase();
      localFontSize = fontSize * 1.5;
    } else if (rawText.startsWith('## ')) {
      alignment = 'center';
      rawText = rawText.substring(3).toUpperCase();
      localFontSize = fontSize * 1.2;
    } else if (rawText.startsWith('### ')) {
      alignment = 'center';
      rawText = rawText.substring(4).toUpperCase();
      localFontSize = fontSize * 0.7;
    } else if (rawText.startsWith('[cap]')) {
      isDropCap = true;
      rawText = rawText.substring(5).trim();
    } else if (rawText.startsWith('[c]')) {
      alignment = 'center';
      rawText = rawText.substring(3).trim();
    } else if (rawText.startsWith('[r]')) {
      alignment = 'right';
      rawText = rawText.substring(3).trim();
    }

    ctx.font = `${localFontSize}px "EB Garamond", serif`;
    const words = rawText.split(/\s+/);
    if (words.length === 0) continue;

    let currentLine: string[] = [];
    let currentLineWidth = (alignment === 'justify' ? indent : 0);
    let lineInParagraph = 0;

    // Drop Cap Logic
    let dropCapWidth = 0;
    if (isDropCap && words.length > 0 && words[0].length > 0) {
      const firstChar = words[0][0];
      const restOfFirstWord = words[0].substring(1);
      const dropCapSize = localFontSize * 3.5;
      ctx.font = `${dropCapSize}px "EB Garamond", serif`;
      dropCapWidth = ctx.measureText(firstChar).width + 15;
      
      // Push the large character
      result.push({ 
        char: firstChar, 
        x: marginLeft, 
        y: currentY + (localLineHeight * 1.8), 
        lineIndex: 0,
        fontSize: dropCapSize
      });
      
      // Update first word
      words[0] = restOfFirstWord;
      currentLineWidth = dropCapWidth;
      ctx.font = `${localFontSize}px "EB Garamond", serif`;
    }

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWidth = ctx.measureText(word + ' ').width;

      const availableForThisLine = contentWidth;
      const lineIndent = (alignment === 'justify' && lineInParagraph === 0 && !isDropCap ? indent : 0);
      const activeLeftMargin = (isDropCap && lineInParagraph < 3) ? dropCapWidth : 0;

      if (currentLineWidth + wordWidth > availableForThisLine && currentLine.length > 0) {
        result.push(...renderLine(
          currentLine, 
          currentY, 
          marginLeft + activeLeftMargin, 
          contentWidth - activeLeftMargin, 
          ctx, 
          alignment, 
          lineInParagraph === 0 && !isDropCap ? indent : 0,
          localFontSize
        ));
        currentY += localLineHeight;
        currentLine = [word];
        currentLineWidth = (isDropCap && lineInParagraph + 1 < 3) ? dropCapWidth + ctx.measureText(word + ' ').width : ctx.measureText(word + ' ').width;
        lineInParagraph++;
      } else {
        currentLine.push(word);
        currentLineWidth += wordWidth;
      }

      if (currentY > height - marginBottom) break;
    }

    // Last line of paragraph
    if (currentLine.length > 0 && currentY <= height - marginBottom) {
      const activeLeftMargin = (isDropCap && lineInParagraph < 3) ? dropCapWidth : 0;
      result.push(...renderLine(
        currentLine, 
        currentY, 
        marginLeft + activeLeftMargin, 
        contentWidth - activeLeftMargin, 
        ctx, 
        alignment === 'justify' ? 'left' : alignment, 
        lineInParagraph === 0 && !isDropCap ? indent : 0,
        localFontSize
      ));
      currentY += localLineHeight;
    }
    
    // Extra spacing after titles
    if (isTitle) currentY += lineHeight * 0.5;
    // Spacing between paragraphs
    currentY += lineHeight * 0.2;
  }

  return result;
}

function renderLine(
  words: string[],
  y: number,
  startX: number,
  availableWidth: number,
  ctx: CanvasRenderingContext2D,
  alignment: 'left' | 'center' | 'right' | 'justify',
  indent: number,
  fontSize: number
): CharacterInfo[] {
  const lineChars: CharacterInfo[] = [];
  ctx.font = `${fontSize}px "EB Garamond", serif`;
  const totalWordsWidth = words.reduce((acc, w, i) => acc + ctx.measureText(w + (i < words.length - 1 ? ' ' : '')).width, 0);
  
  let currentX = startX + indent;

  if (alignment === 'center') {
    currentX = startX + (availableWidth - totalWordsWidth) / 2;
  } else if (alignment === 'right') {
    currentX = startX + availableWidth - totalWordsWidth;
  }

  if (alignment === 'justify' && words.length > 1) {
    const totalWordsOnlyWidth = words.reduce((acc, w) => acc + ctx.measureText(w).width, 0);
    const spaceWidth = (availableWidth - indent - totalWordsOnlyWidth) / (words.length - 1);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (const char of word) {
        lineChars.push({ char, x: currentX, y, lineIndex: 0, fontSize });
        currentX += ctx.measureText(char).width;
      }
      if (i < words.length - 1) {
        currentX += spaceWidth;
      }
    }
  } else {
    // Left, center, right
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (const char of word) {
        lineChars.push({ char, x: currentX, y, lineIndex: 0, fontSize });
        currentX += ctx.measureText(char).width;
      }
      if (i < words.length - 1) {
        currentX += ctx.measureText(' ').width;
      }
    }
  }

  return lineChars;
}
