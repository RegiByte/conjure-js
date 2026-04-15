(ns user.strings-regex
  (:require [clojure.string :as str]))

;; Deep Dive: Strings & Regex
;;
;; Press ⌘+Enter on any form to evaluate it.


;; Building & Inspecting Strings

(comment
  ;; str — concatenate anything into a string
  (str "hello" " " "world")         ;; => "hello world"
  (str :keyword)                     ;; => ":keyword"
  (str 42)                           ;; => "42"
  (str nil)                          ;; => ""  (nil becomes empty string)
  (str true false)                   ;; => "truefalse"

  (subs "hello world" 6)             ;; => "world"
  (subs "hello world" 0 5)           ;; => "hello"

  (count "hello")                    ;; => 5
  (count "")                         ;; => 0

  (string? "hello")                  ;; => true
  (string? :not-a-string)            ;; => false
)


;; clojure.string  (required as str)

(comment
  ;; Case
  (str/upper-case "hello")          ;; => "HELLO"
  (str/lower-case "WORLD")          ;; => "world"
  (str/capitalize "hello world")    ;; => "Hello world"

  ;; Trimming whitespace
  (str/trim  "  hello  ")           ;; => "hello"
  (str/triml "  hello  ")           ;; => "hello  "  (left only)
  (str/trimr "  hello  ")           ;; => "  hello"  (right only)
  (str/trim-newline "hello\n")      ;; => "hello"

  ;; Joining
  (str/join ", " ["one" "two" "three"])  ;; => "one, two, three"
  (str/join ["a" "b" "c"])               ;; => "abc"

  ;; Splitting
  (str/split "a,b,c,d" #",")        ;; => ["a" "b" "c" "d"]
  (str/split "hello world" #"\s+")  ;; => ["hello" "world"]
  (str/split-lines "one\ntwo\nthree") ;; => ["one" "two" "three"]

  ;; Search predicates
  (str/includes?    "hello world" "world")  ;; => true
  (str/starts-with? "hello world" "hello")  ;; => true
  (str/ends-with?   "hello world" "world")  ;; => true
  (str/blank?       "   ")                  ;; => true
  (str/blank?       "  x  ")               ;; => false

  (str/index-of      "hello world" "world")  ;; => 6
  (str/last-index-of "abcabc" "b")           ;; => 4

  (str/reverse "hello")             ;; => "olleh"
)


;; Replace

(comment
  ;; Literal match
  (str/replace "hello world" "world" "Clojure") ;; => "hello Clojure"

  ;; Regex — all matches
  (str/replace "hello world" #"[aeiou]" "*")    ;; => "h*ll* w*rld"

  ;; Regex + function — receives match vector, returns replacement string
  (str/replace "hello world"
               #"\b\w"
               (fn [[match]] (str/upper-case match)))
  ;; => "Hello World"

  ;; replace-first — only the first occurrence
  (str/replace-first "aabbaabb" "b" "X")        ;; => "aaXbaabb"
  (str/replace-first "hello" #"[aeiou]" "*")    ;; => "h*llo"

  ;; escape — apply a substitution map to every character
  (str/escape "hello & <world>" {\& "&amp;" \< "&lt;" \> "&gt;"})
  ;; => "hello &amp; &lt;world&gt;"
)


;; Strings as Sequences
;;
;; Strings are seqable — all sequence functions work on them.

(comment
  (seq "hello")                      ;; => ("h" "e" "l" "l" "o")

  (first "hello")                    ;; => "h"
  (rest  "hello")                    ;; => ("e" "l" "l" "o")
  (last  "hello")                    ;; => "o"

  (count "hello")                    ;; => 5

  (map str/upper-case (seq "hello")) ;; => ("H" "E" "L" "L" "O")

  ;; Set literals not supported yet — use an explicit membership check:
  (filter (fn [c] (some #(= c %) ["a" "e" "i" "o" "u"])) (seq "hello world"))
  ;; => ("e" "o" "o")  (vowels only)

  ;; Rebuild a string after seq manipulation
  (apply str (filter (fn [c] (some #(= c %) ["a" "e" "i" "o" "u"])) (seq "hello world")))
  ;; => "eoo"

  (count "café")                     ;; => 4  (not byte count)
  (seq "café")                       ;; => ("c" "a" "f" "é")
)


;; Regex Literals
;;
;; Patterns follow JavaScript regex rules.

(comment
  #"[0-9]+"                          ;; => #"[0-9]+"

  ;; re-find — first match (string if no groups, vector if groups)
  (re-find #"\d+" "abc123def456")    ;; => "123"
  (re-find #"(\w+)@(\w+)" "me@example.com")
  ;; => ["me@example.com" "me" "example"]  (full match + groups)

  ;; re-matches — match against the ENTIRE string
  (re-matches #"\d+" "123")          ;; => "123"
  (re-matches #"\d+" "123abc")       ;; => nil  (not entire string)
  (re-matches #"(\d{4})-(\d{2})-(\d{2})" "2024-03-15")
  ;; => ["2024-03-15" "2024" "03" "15"]

  ;; re-seq — all matches as a lazy sequence
  (re-seq #"\d+" "abc123def456ghi789")   ;; => ("123" "456" "789")
  (re-seq #"\b\w{4}\b" "the quick brown fox")
  ;; => ("quick" "brown")  (4-letter words)

  ;; re-pattern — create a regex from a string (useful when dynamic)
  (re-find (re-pattern "hello") "say hello!")  ;; => "hello"
)


;; Inline Regex Flags
;;
;;   (?i)  case-insensitive
;;   (?m)  multiline  (^ and $ match line boundaries)
;;   (?s)  dotAll     (. matches newlines too)

(comment
  (re-find #"(?i)hello" "say HELLO!")     ;; => "HELLO"
  (re-matches #"(?i)[a-z]+" "HeLLo")     ;; => "HeLLo"

  (re-seq #"(?m)^\w+" "one\ntwo\nthree") ;; => ("one" "two" "three")

  (re-seq #"(?im)^hello" "Hello\nHELLO\nhello")
  ;; => ("Hello" "HELLO" "hello")
)


;; Practical Patterns

(comment
  ;; Parse a CSV row
  (defn parse-csv [line]
    (str/split line #","))

  (parse-csv "alice,30,admin")           ;; => ["alice" "30" "admin"]

  ;; Extract structured data with groups
  (defn parse-date [s]
    (let [[_ y m d] (re-matches #"(\d{4})-(\d{2})-(\d{2})" s)]
      {:year y :month m :day d}))

  (parse-date "2024-03-15")
  ;; => {:year "2024" :month "03" :day "15"}

  ;; Slugify — URL-safe string
  (defn slugify [s]
    (-> s
        str/trim
        str/lower-case
        (str/replace #"[^a-z0-9\s-]" "")
        (str/replace #"\s+" "-")))

  (slugify "  Hello, World! It's Clojure  ")
  ;; => "hello-world-its-clojure"

  ;; Template substitution — replace {{key}} placeholders
  (defn render [template data]
    (str/replace template
                 #"\{\{(\w+)\}\}"
                 (fn [[_ key]] (get data key ""))))

  (render "Hello, {{name}}! You have {{count}} messages."
          {"name" "Alice" "count" "3"})
  ;; => "Hello, Alice! You have 3 messages."
)
