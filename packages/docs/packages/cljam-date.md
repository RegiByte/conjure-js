# cljam-date

[![npm](https://img.shields.io/npm/v/%40regibyte%2Fcljam-date)](https://www.npmjs.com/package/@regibyte/cljam-date)

Date handling for cljam. Construction, accessors, arithmetic, and formatting via `cljam.date`.

## Installation

```bash
npm install @regibyte/cljam-date
```

```typescript
import { library as dateLib } from '@regibyte/cljam-date'

const session = createSession({ ...nodePreset(), libraries: [dateLib] })
```

## Usage

```clojure
(require '[cljam.date :as d])

;; Construction
(def now     (d/now))
(def past    (d/from-millis 0))
(def release (d/from-iso "2026-04-11T00:00:00Z"))

;; Accessors
(d/year now)    ;; => 2026
(d/month now)   ;; => 4   (1-indexed, January = 1)
(d/day now)     ;; => 14
(d/hour now)    ;; => 23

;; Serialization
(d/to-iso now)    ;; => "2026-04-14T23:00:00.000Z"
(d/to-millis now) ;; => 1744671600000

;; Arithmetic
(d/add-days now 7)       ;; => date 7 days from now
(d/add-hours now 3)      ;; => date 3 hours from now
(d/diff-days past now)   ;; => whole days between past and now

;; Formatting (wraps Intl.DateTimeFormat)
(d/format now)                             ;; system locale, default options
(d/format now "en-US")
(d/format now "de-DE" {:year "numeric" :month "long" :day "numeric"})
;; => "14. April 2026"
```

## API

| Function | Signature | Description |
|---|---|---|
| `now` | `() → date` | Current instant |
| `from-millis` | `(ms) → date` | From epoch milliseconds |
| `from-iso` | `(s) → date` | From ISO 8601 string |
| `to-millis` | `(d) → number` | Epoch milliseconds |
| `to-iso` | `(d) → string` | ISO 8601 string |
| `year` | `(d) → number` | Full year |
| `month` | `(d) → number` | Month, 1-indexed (Jan = 1) |
| `day` | `(d) → number` | Day of month (1–31) |
| `hour` | `(d) → number` | Hours (0–23) |
| `minute` | `(d) → number` | Minutes (0–59) |
| `second` | `(d) → number` | Seconds (0–59) |
| `format` | `(d), (d locale), (d locale opts) → string` | Format via Intl.DateTimeFormat |
| `add-days` | `(d n) → date` | Add n days |
| `add-hours` | `(d n) → date` | Add n hours |
| `diff-days` | `(a b) → number` | Whole days between a and b |
