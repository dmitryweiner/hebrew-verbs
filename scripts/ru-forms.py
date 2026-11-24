# Russian forms for the phrases after an answer ("ты (ж.) ела / съела"), from
# the hand-written pairs of data/ru.tsv, conjugated by pymorphy3 (MIT, used
# here only; nothing of it ships). Writes data/ru-forms.json, which
# scripts/build-verbs.mjs reads, so the build itself needs no Python.
#
#   python3 -m venv .cache/venv && .cache/venv/bin/pip install pymorphy3
#   .cache/venv/bin/python scripts/ru-forms.py          # write data/ru-forms.json
#   .cache/venv/bin/python scripts/ru-forms.py --check  # only report problems
#
# Checks: the ipf verb is imperfective, the pf verb perfective, every form
# exists. A problem is printed and the script exits with 1.
#
# Output, by lemma:
#   verb:    { ipf, pf?, present: {1s..3p}?, past: { ipf: {m, f, pl}, pf? },
#              future: { ipf: {1s..3p}, pf?: {1s..3p} } }
#   passive: { ipf: "быть приглашённым", short: { m, f, pl } }  (the app adds
#            был / буду: "она была приглашена")

import json
import sys
from pathlib import Path

import pymorphy3

ROOT = Path(__file__).resolve().parent.parent
PERSONS = {'1s': ('1per', 'sing'), '2s': ('2per', 'sing'), '3s': ('3per', 'sing'),
           '1p': ('1per', 'plur'), '2p': ('2per', 'plur'), '3p': ('3per', 'plur')}
GENDERS = {'m': {'masc', 'sing'}, 'f': {'femn', 'sing'}, 'pl': {'plur'}}
BUDU = {'1s': 'буду', '2s': 'будешь', '3s': 'будет', '1p': 'будем', '2p': 'будете', '3p': 'будут'}

morph = pymorphy3.MorphAnalyzer()
problems = []


def rows(path):
    for line in path.read_text(encoding='utf-8').split('\n'):
        if line.strip() and not line.startswith('#'):
            yield (line.split('\t') + ['', '', ''])[:4]


def infinitive(word, aspect, lemma):
    """The infinitive parse of `word` with this aspect, or None (a problem)."""
    parses = [p for p in morph.parse(word) if p.tag.POS == 'INFN' and p.word == word]
    for p in parses:
        if aspect in p.tag:
            return p
    problems.append(f'{lemma}: {word} is not an {aspect} infinitive '
                    f'({", ".join(str(p.tag) for p in parses) or "unknown"})')
    return None


def form(parse, grammemes, lemma, label):
    for f in parse.lexeme:
        if grammemes <= f.tag.grammemes and 'VERB' in f.tag:
            return f.word
    problems.append(f'{lemma}: no {label} of {parse.word}')
    return None


def tense(parse, tense_name, lemma, rest):
    out = {}
    for key, (person, number) in PERSONS.items():
        w = form(parse, {tense_name, person, number, 'indc'}, lemma, f'{tense_name} {key}')
        if w:
            out[key] = w + rest
    return out


def past(parse, lemma, rest):
    out = {}
    for key, g in GENDERS.items():
        w = form(parse, {'past', 'indc'} | g, lemma, f'past {key}')
        if w:
            out[key] = w + rest
    return out


def passive(lemma, ipf):
    word = ipf.split(' ', 1)[1]
    parses = [p for p in morph.parse(word) if p.tag.POS in ('ADJF', 'PRTF') and 'ablt' in p.tag]
    if not parses:
        problems.append(f'{lemma}: {word} is not an adjective or participle in the instrumental')
        return None
    p = parses[0]
    short = 'ADJS' if p.tag.POS == 'ADJF' else 'PRTS'
    out = {}
    for key, g in GENDERS.items():
        f = p.inflect({short} | g)
        if not f:
            problems.append(f'{lemma}: no short {key} of {p.normal_form}')
            continue
        out[key] = f.word
    return {'ipf': ipf, 'short': out}


def verb(lemma, ipf, pf):
    head, _, tail = ipf.partition(' ')
    rest = f' {tail}' if tail else ''
    p = infinitive(head, 'impf', lemma)
    if not p:
        return None
    out = {'ipf': ipf}
    if pf:
        out['pf'] = pf
    present = tense(p, 'pres', lemma, rest) if lemma != 'היה' else None
    if present is not None:
        out['present'] = present
    out['past'] = {'ipf': past(p, lemma, rest)}
    # быть has a simple future: буду, not буду быть.
    if any('futr' in f.tag for f in p.lexeme):
        out['future'] = {'ipf': tense(p, 'futr', lemma, rest)}
    else:
        out['future'] = {'ipf': {k: f'{v} {ipf}' for k, v in BUDU.items()}}
    if pf:
        phead, _, ptail = pf.partition(' ')
        q = infinitive(phead, 'perf', lemma)
        if q:
            prest = f' {ptail}' if ptail else ''
            out['past']['pf'] = past(q, lemma, prest)
            out['future']['pf'] = tense(q, 'futr', lemma, prest)
    return out


def main():
    lemmas = [r[0] for r in rows(ROOT / 'data/verbs.tsv')]
    ru = {r[0]: r for r in rows(ROOT / 'data/ru.tsv')}
    out = {}
    for lemma in lemmas:
        if lemma not in ru:
            continue
        _, translations, ipf, pf = ru[lemma]
        if not translations or not ipf:
            problems.append(f'{lemma}: no translation or no ipf')
            continue
        forms = passive(lemma, ipf) if ipf.startswith('быть ') else verb(lemma, ipf, pf)
        if forms:
            out[lemma] = forms
    for lemma in ru:
        if lemma not in lemmas:
            problems.append(f'{lemma}: not in data/verbs.tsv')
    missing = [l for l in lemmas if l not in ru]
    print(f'{len(out)} verbs, {len(missing)} without a translation', file=sys.stderr)
    for p in problems:
        print(p, file=sys.stderr)
    if '--check' not in sys.argv:
        text = json.dumps(out, ensure_ascii=False, indent=1)
        (ROOT / 'data/ru-forms.json').write_text(text + '\n', encoding='utf-8')
    sys.exit(1 if problems else 0)


main()
