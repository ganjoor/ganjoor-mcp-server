# [![evaluation/: 10 multi-step Persian poetry QA evaluation scenarios](../.github/assets/banners/evaluation.svg)](https://github.com/ganjoor)

Evaluation corpus for agent performance against the Ganjoor API.

## Contents

- `evaluation.xml` — 10 question/answer pairs, each requiring several tool calls to answer. The questions cross-reference poets against centuries, walk the kinship graph, compare a poem's prosody against the corpus-wide metre list, and resolve a reply-poem chain through quotation records. Every answer was verified against the live API before being recorded.

Replay the corpus with `npx tsx tests/verify-evaluation.ts`.
