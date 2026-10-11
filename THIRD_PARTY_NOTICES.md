# Third-party notices

## WANDS (Wayfair ANnotation Dataset)

Source: https://github.com/wayfair/WANDS

These files are derived from WANDS by `scripts/import-wands.ts` and the other
`npm run data:*` scripts:

- `data/corpus.ndjson` (product catalog)
- `data/judgments.ndjson` (queries and human relevance labels)
- `data/clicks.ndjson`, `data/logged-ranking.ndjson` (simulated from the WANDS labels)
- `data/models/` and `data/precomputed/` (trained on or computed from the files above)

The `priceCents` and `postedAt` fields in the catalog are synthetic and are not
part of WANDS.

WANDS is distributed under the following license:

```
MIT License

Copyright (c) 2021 ecir2022

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
