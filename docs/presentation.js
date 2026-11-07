/* Display-only helpers. Approved story strings and saved page indices stay intact. */
(function (root) {
  'use strict';

  function readerBlocks(pageText) {
    if (typeof pageText !== 'string') throw new TypeError('本文の表示データを読み込めませんでした。');
    // The source's empty lines describe paragraph/scene boundaries, not blank
    // screen-height. Keep each nonempty source line as its own block so dialogue
    // changes and deliberate line breaks never become a joined sentence.
    return pageText.replace(/\r\n?/g, '\n').split('\n').flatMap(line => {
      if (!line.trim()) return [];
      if (line.trim() === '◇') return [{type: 'scene', text: line, indent: false}];
      const dialogue = /^[ \t　]*[「『]/u.test(line);
      return [{
        type: dialogue ? 'dialogue' : 'paragraph',
        text: line,
        indent: !dialogue && !/^[ \t　]|^#{1,6} /u.test(line)
      }];
    });
  }

  function channels(color) {
    if (typeof color !== 'string') throw new TypeError('色は文字列で指定してください。');
    const hex = color.trim().replace(/^#/, '');
    if (/^[\da-f]{3}$/i.test(hex)) return [...hex].map(channel => parseInt(channel + channel, 16));
    if (/^[\da-f]{6}$/i.test(hex)) return [0, 2, 4].map(start => parseInt(hex.slice(start, start + 2), 16));
    const rgb = color.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);
    if (rgb && rgb.slice(1).every(channel => Number(channel) >= 0 && Number(channel) <= 255)) return rgb.slice(1).map(Number);
    throw new TypeError('不透明なRGB色を指定してください。');
  }

  function luminance(color) {
    const linear = channels(color).map(channel => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }

  function contrastRatio(foreground, background) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  }

  const palettes = Object.freeze([
    Object.freeze({id: 'paper', name: '明るい紙色', text: '#242a25', background: '#fffdf7', reason: '白に近い暖色の背景と濃い本文色で、明朝体の雰囲気と可読性を両立する。'}),
    Object.freeze({id: 'neutral', name: '白と墨色', text: '#202620', background: '#ffffff', reason: 'コントラストを十分確保する白背景の比較案。'}),
    Object.freeze({id: 'sepia', name: '淡いセピア', text: '#352b22', background: '#f3ead7', reason: '暖色を強めた比較案。装飾より本文の識別を優先する。'})
  ]);

  const API = Object.freeze({readerBlocks, contrastRatio, palettes, selectedPalette: 'paper'});
  root.HillRoadPresentation = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
