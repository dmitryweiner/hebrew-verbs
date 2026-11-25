// A verb's picture (plan 1.4): the emoji, or its Twemoji copy where the font
// lacks it; an own drawing as a mask painted in the text colour, so its
// currentColor lines follow the theme.

import { h } from '../dom';
import type { EmojiSupport } from '../emoji';
import { emojiParts, type Picture } from '../pictures';

export function pictureElement(picture: Picture, emoji: EmojiSupport): HTMLElement {
  if (picture.kind === 'svg') {
    const el = h('span', { class: 'picture drawing', 'aria-hidden': 'true' });
    // Absolute: a relative url() in a custom property would resolve against the stylesheet's folder.
    el.style.setProperty('--picture', `url("${new URL(picture.src, document.baseURI).href}")`);
    return el;
  }
  const el = h('span', { class: 'picture emoji', 'aria-hidden': 'true' });
  const parts = emojiParts(picture.emoji).map((part, i) => ({ part, file: picture.twemoji[i] }));
  for (const { part, file } of parts) {
    const slot = h('span', {}, part);
    el.append(slot);
    if (!file || emoji.renders(part)) continue;
    emoji
      .twemoji()
      .then((copies) => {
        const svg = copies[file];
        if (svg) slot.replaceWith(h('img', { alt: part, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }));
      })
      .catch(() => {}); // the emoji as text is the fallback
  }
  return el;
}
