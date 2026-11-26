// The about page (decisions 18, 73): what the app is, the sources of its data
// with their licenses (the attribution CC BY-SA and CC BY ask for), the
// licenses of the data and the code, the source code and the build's version.

import { h } from '../dom';
import { fill, texts } from '../texts';
import type { AppContext } from './context';

interface License {
  name: string;
  url: string;
}

const CC_BY_SA: License = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };
const CC_BY: License = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
const GPL: License = { name: 'GPL-3.0-or-later', url: 'https://www.gnu.org/licenses/gpl-3.0.html' };
const REPO = 'https://github.com/dmitryweiner/hebrew-verbs';

/** The sources by their own names; a build-only tool ships nothing, so it has no license here. */
const SOURCES: { id: keyof typeof texts.about.sources; name: string; url: string; license?: License }[] = [
  { id: 'wiktionary', name: 'Wiktionary', url: 'https://en.wiktionary.org/', license: CC_BY_SA },
  { id: 'frequencyWords', name: 'FrequencyWords', url: 'https://github.com/hermitdave/FrequencyWords', license: CC_BY_SA },
  { id: 'hspell', name: 'Hspell', url: 'http://hspell.ivrix.org.il/' },
  { id: 'pymorphy', name: 'pymorphy3', url: 'https://github.com/no-plagiarism/pymorphy3' },
  { id: 'twemoji', name: 'Twemoji', url: 'https://github.com/jdecked/twemoji', license: CC_BY },
];

const licenseLink = ({ name, url }: License) => h('a', { class: 'license', href: url }, name);

/** A web address without its scheme, a line break allowed after each slash: github.com/<wbr>dmitryweiner/<wbr>hebrew-verbs. */
const address = (url: string) =>
  url
    .replace(/^https?:\/\//u, '')
    .split('/')
    .flatMap((part, i) => (i === 0 ? [part] : ['/', h('wbr'), part]));

/** 2026-11-26 → 26.11.2026. */
const russianDate = (date: string) => date.split('-').toReversed().join('.');

export function aboutView(root: HTMLElement, ctx: AppContext): () => void {
  root.replaceChildren(
    h('h1', {}, texts.about.heading),
    h('p', {}, texts.about.intro),
    h('p', {}, texts.about.offline),
    h('p', {}, texts.about.storage),
    h('h2', {}, texts.about.sourcesHeading),
    h('p', {}, texts.about.made),
    h(
      'ul',
      { class: 'sources' },
      ...SOURCES.map(({ id, name, url, license }) =>
        h(
          'li',
          { 'data-source': id },
          h('a', { class: 'source', href: url }, name),
          ' — ',
          h('span', { class: 'what' }, texts.about.sources[id]),
          license && ' · ',
          license && licenseLink(license),
        ),
      ),
    ),
    h('h2', {}, texts.about.licensesHeading),
    h(
      'dl',
      { class: 'about-meta' },
      h('dt', {}, texts.about.data),
      h('dd', {}, licenseLink(CC_BY_SA)),
      h('dt', {}, texts.about.code),
      h('dd', {}, licenseLink(GPL)),
      h('dt', {}, texts.about.repo),
      h('dd', {}, h('a', { href: REPO }, ...address(REPO))),
      h('dt', {}, texts.about.version),
      h('dd', { class: 'version' }, fill(texts.about.versionOf, { version: ctx.build.version, date: russianDate(ctx.build.date) })),
    ),
  );
  return () => {};
}
