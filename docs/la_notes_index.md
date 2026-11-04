# Course notes index (`docs/la_notes.txt`)

`docs/la_notes.txt` is `pdftotext -layout` of `docs/la_2020_HUGE.pdf` (219 pages).
**Use it instead of the PDF.** Workflow:

1. Find the item below, or `grep -n "Lemma 1.1.2" docs/la_notes.txt`.
2. Read only the lines you need: `sed -n '240,280p' docs/la_notes.txt`.
3. Only if an exact formula is still unclear, render that one page:
   `pdftoppm -r 100 -png -f <page> -l <page> docs/la_2020_HUGE.pdf /tmp/pg` (at most 2 pages per visualisation).

`page` = PDF page number (what `pdftoppm -f/-l` wants). `line` = line in `la_notes.txt`.

## Numbered items

| item | page | line |
|---|---|---|
| Definition 1.0.1 | 6 | 93 |
| Corollary 1.1.1 | 27 | 609 |
| Corollary 1.1.1 | 48 | 1206 |
| Definition 1.1.1 | 8 | 142 |
| Example 1.1.1 | 17 | 337 |
| Lemma 1.1.1 | 11 | 216 |
| Theorem 1.1.1 | 22 | 468 |
| Definition 1.1.2 | 9 | 175 |
| Example 1.1.2 | 19 | 396 |
| Lemma 1.1.2 | 13 | 262 |
| Definition 1.1.3 | 14 | 275 |
| Definition 1.1.4 | 16 | 316 |
| Corollary 1.2.1 | 59 | 1508 |
| Definition 1.2.1 | 32 | 722 |
| Example 1.2.1 | 37 | 879 |
| Lemma 1.2.1 | 42 | 1014 |
| Definition 1.2.2 | 40 | 967 |
| Lemma 1.2.2 | 45 | 1112 |
| Definition 1.2.3 | 41 | 995 |
| Lemma 1.2.3 | 49 | 1215 |
| Definition 1.2.4 | 48 | 1190 |
| Lemma 1.2.4 | 54 | 1352 |
| Definition 1.2.5 | 52 | 1289 |
| Lemma 1.2.5 | 57 | 1436 |
| Definition 1.2.6 | 60 | 1548 |
| Lemma 1.2.6 | 61 | 1571 |
| Corollary 1.3.1 | 73 | 1903 |
| Theorem 1.3.1 | 66 | 1699 |
| Theorem 1.3.2 | 76 | 1999 |
| Definition 2.1.1 | 87 | 2266 |
| Example 2.1.1 | 90 | 2343 |
| Lemma 2.1.1 | 93 | 2426 |
| Theorem 2.1.1 | 97 | 2539 |
| Example 2.1.2 | 91 | 2362 |
| Lemma 2.1.2 | 96 | 2506 |
| Example 2.1.3 | 92 | 2394 |
| Definition 2.2.1 | 105 | 2757 |
| Lemma 2.2.1 | 107 | 2815 |
| Theorem 2.2.1 | 109 | 2873 |
| Definition 2.2.2 | 105 | 2767 |
| Lemma 2.2.2 | 108 | 2848 |
| Theorem 2.2.2 | 115 | 3055 |
| Definition 2.2.3 | 114 | 3029 |
| Definition 2.3.1 | 120 | 3194 |
| Lemma 2.3.1 | 121 | 3219 |
| Theorem 2.3.1 | 124 | 3308 |
| Definition 2.3.2 | 122 | 3250 |
| Theorem 2.3.2 | 131 | 3512 |
| Example 2.4.1 | 143 | 3871 |
| Example 2.4.2 | 151 | 4069 |
| Definition 3.1.1 | 165 | 4492 |
| Example 3.1.1 | 156 | 4248 |
| Theorem 3.1.1 | 166 | 4518 |
| Example 3.1.2 | 161 | 4372 |
| Definition 3.2.1 | 173 | 4717 |
| Example 3.2.1 | 178 | 4867 |
| Lemma 3.2.1 | 169 | 4596 |
| Definition 3.2.2 | 174 | 4745 |
| Example 3.2.2 | 180 | 4914 |
| Definition 3.2.3 | 174 | 4754 |
| Example 3.4.1 | 185 | 5022 |
| Lemma 3.4.1 | 186 | 5062 |
| Corollary 3.5.1 | 215 | 5953 |
| Lemma 3.5.1 | 202 | 5535 |
| Theorem 3.5.1 | 205 | 5610 |
| Theorem 3.5.2 | 208 | 5716 |
| Theorem 3.5.3 | 212 | 5849 |

## Displayed equations (first occurrence)

| eq | page |
|---|---|
| (1.1) | 5 |
| (1.2) | 7 |
| (1.3) | 7 |
| (1.4) | 7 |
| (1.5) | 8 |
| (1.6) | 13 |
| (1.7) | 13 |
| (1.8) | 14 |
| (1.9) | 19 |
| (1.10) | 22 |
| (1.11) | 26 |
| (1.12) | 27 |
| (1.13) | 29 |
| (1.14) | 37 |
| (1.15) | 42 |
| (1.16) | 43 |
| (1.17) | 44 |
| (1.18) | 44 |
| (1.19) | 45 |
| (1.20) | 45 |
| (1.21) | 48 |
| (1.22) | 49 |
| (1.23) | 54 |
| (1.24) | 54 |
| (1.25) | 56 |
| (1.26) | 56 |
| (1.27) | 58 |
| (1.28) | 59 |
| (1.29) | 65 |
| (1.30) | 65 |
| (1.31) | 66 |
| (1.32) | 69 |
| (1.33) | 75 |
| (1.34) | 76 |
| (1.35) | 77 |
| (2.1) | 82 |
| (2.2) | 82 |
| (2.3) | 85 |
| (2.4) | 94 |
| (2.5) | 95 |
| (2.6) | 99 |
| (2.7) | 102 |
| (2.8) | 102 |
| (2.9) | 106 |
| (2.10) | 106 |
| (2.11) | 112 |
| (2.12) | 117 |
| (2.13) | 119 |
| (2.14) | 124 |
| (2.15) | 130 |
| (2.16) | 134 |
| (2.17) | 134 |
| (2.18) | 135 |
| (2.19) | 136 |
| (2.20) | 139 |
| (2.21) | 141 |
| (2.22) | 148 |
| (2.23) | 150 |
| (3.1) | 156 |
| (3.2) | 164 |
| (3.3) | 165 |
| (3.4) | 166 |
| (3.5) | 169 |
| (3.6) | 172 |
| (3.7) | 172 |
| (3.8) | 173 |
| (3.9) | 173 |
| (3.10) | 174 |
| (3.11) | 174 |
| (3.12) | 175 |
| (3.13) | 176 |
| (3.14) | 176 |
| (3.15) | 176 |
| (3.16) | 177 |
| (3.17) | 177 |
| (3.18) | 177 |
| (3.19) | 178 |
| (3.20) | 180 |
| (3.21) | 182 |
| (3.22) | 183 |
| (3.23) | 186 |
| (3.24) | 186 |
| (3.25) | 189 |
| (3.26) | 212 |
| (3.27) | 215 |
| (3.28) | 216 |
