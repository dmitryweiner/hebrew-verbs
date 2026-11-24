#!/bin/sh
# Downloads the raw data sources into .cache/dl/ (git-ignored) and turns
# Hspell's generators into UTF-8 word lists. Needs curl, perl, iconv.
# Safe to rerun: it overwrites what it made before.
#
#   sh scripts/fetch-sources.sh
#
# Makes: he_50k.txt (FrequencyWords, OpenSubtitles 2018, CC BY-SA 4.0);
# hspell-1.4/ and from it woo-forms.txt (verb forms), wolig-forms.txt
# (noun and adjective forms), milot.hif.txt, extrawords.hif.txt,
# biza-nouns.hif.txt (Hspell, AGPL-3.0: build scripts only, never shipped).
# Then: node scripts/verb-frequency.mjs, node scripts/probe/wiktionary.mjs.

set -eu
dl="$(cd "$(dirname "$0")/.." && pwd)/.cache/dl"
mkdir -p "$dl"
cd "$dl"

curl -sSfL -o he_50k.txt \
  https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/he/he_50k.txt
curl -sSfL -o hspell.tar.gz http://hspell.ivrix.org.il/hspell-1.4.tar.gz
tar xzf hspell.tar.gz

cd hspell-1.4
# The generators also write shemp.dat next to themselves; it is not needed.
perl -w woo -d woo.dat 2>/dev/null | iconv -f ISO-8859-8 -t UTF-8 > ../woo-forms.txt
perl -w wolig.pl -d wolig.dat 2>/dev/null | iconv -f ISO-8859-8 -t UTF-8 > ../wolig-forms.txt
for f in milot.hif extrawords.hif biza-nouns.hif; do
  iconv -f ISO-8859-8 -t UTF-8 "$f" > "../$f.txt"
done

cd ..
wc -l he_50k.txt woo-forms.txt wolig-forms.txt
