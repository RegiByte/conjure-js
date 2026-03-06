(ns user.hof
  (:require [clojure.string :as str]))

;; Deep Dive: Higher-Order Functions & Transducers
;;
;; A higher-order function (HOF) is one that takes functions as arguments
;; or returns them as results.  This is where Clojure's expressiveness shines.
;;
;; Press ⌘+Enter on any form to evaluate it.


;; ─────────────────────────────────────────────
;; SECTION 1 — map
;; ─────────────────────────────────────────────

(comment
  ;; Basic: apply f to every element
  (map inc [1 2 3 4 5])                  ;; => (2 3 4 5 6)
  (map str [:a :b :c])                   ;; => ("a" "b" "c")
  (map count ["hi" "hello" "hey"])        ;; => (2 5 3)

  ;; With an anonymous function
  (map (fn [x] (* x x)) (range 1 6))    ;; => (1 4 9 16 25)
  (map #(* % %) (range 1 6))            ;; same, shorter syntax

  ;; Multi-collection: zips and stops at the shortest
  (map + [1 2 3] [10 20 30])            ;; => (11 22 33)
  (map vector [:a :b :c] [1 2 3])       ;; => ([:a 1] [:b 2] [:c 3])
  (map + [1 2 3] [10 20 30] [100 200 300]) ;; => (111 222 333)

  ;; map-indexed: f receives [index value]
  (map-indexed vector [:a :b :c])        ;; => ([0 :a] [1 :b] [2 :c])
  (map-indexed (fn [i v] (str i ": " v))
               ["alice" "bob" "carol"])  ;; => ("0: alice" "1: bob" "2: carol")
)


;; ─────────────────────────────────────────────
;; SECTION 2 — filter / remove
;; ─────────────────────────────────────────────

(comment
  (filter even?  [1 2 3 4 5 6])         ;; => (2 4 6)
  (filter string? [1 "a" :b "c" 2])     ;; => ("a" "c")
  (filter :active [{:name "a" :active true}
                   {:name "b" :active false}
                   {:name "c" :active true}])
  ;; => ({:name "a" :active true} {:name "c" :active true})

  (remove even? [1 2 3 4 5 6])          ;; => (1 3 5)
  (remove nil?  [1 nil 2 nil 3])        ;; => (1 2 3)

  ;; Custom predicates
  (filter #(> (count %) 3) ["hi" "hello" "hey" "howdy"])
  ;; => ("hello" "howdy")
)


;; ─────────────────────────────────────────────
;; SECTION 3 — reduce
;; ─────────────────────────────────────────────
;;
;; reduce is the Swiss army knife — it can implement almost everything else.

(comment
  ;; Two-arity: uses first two elements to start
  (reduce + [1 2 3 4 5])                 ;; => 15
  (reduce * [1 2 3 4 5])                 ;; => 120
  (reduce str ["a" "b" "c"])             ;; => "abc"

  ;; Three-arity: explicit initial accumulator
  (reduce + 100 [1 2 3])                 ;; => 106
  (reduce conj [] '(1 2 3))              ;; => [1 2 3]
  (reduce (fn [m [k v]] (assoc m k v))
          {}
          [[:a 1] [:b 2] [:c 3]])        ;; => {:a 1 :b 2 :c 3}

  ;; Building a frequency map from scratch
  (reduce (fn [acc x]
            (update acc x (fnil inc 0)))
          {}
          [:a :b :a :c :b :a])           ;; => {:a 3 :b 2 :c 1}

  ;; Early termination with `reduced`
  ;; `reduced` wraps a value to signal "stop now"
  (reduce (fn [acc x]
            (if (nil? x)
              (reduced acc)
              (conj acc x)))
          []
          [1 2 3 nil 4 5])               ;; => [1 2 3]  (stopped at nil)

  ;; find the first number > 100 in a large sequence
  (reduce (fn [_ x]
            (when (> x 100) (reduced x)))
          nil
          (range 1000))                  ;; => 101
)


;; ─────────────────────────────────────────────
;; SECTION 4 — apply, partial, comp
;; ─────────────────────────────────────────────

(comment
  ;; apply — call f with a collection as its argument list
  (apply + [1 2 3 4])             ;; => 10
  (apply str ["a" "b" "c"])       ;; => "abc"
  (apply max [3 1 4 1 5 9 2 6])   ;; => 9

  ;; Leading fixed args before the collection
  (apply str "prefix-" ["a" "b"]) ;; => "prefix-ab"

  ;; partial — fix some leading arguments
  (def add10 (partial + 10))
  (add10 5)                        ;; => 15
  (map add10 [1 2 3])              ;; => (11 12 13)

  (def greet (partial str "Hello, "))
  (greet "World!")                  ;; => "Hello, World!"

  ;; comp — compose right-to-left
  (def clean (comp str/trim str/lower-case))
  (clean "  HELLO  ")              ;; => "hello"

  ((comp inc inc inc) 0)           ;; => 3
  ((comp str/upper-case str/trim) "  hello  ") ;; => "HELLO"

  ;; identity — returns its argument unchanged (useful as a no-op)
  (map identity [1 2 3])           ;; => (1 2 3)
  (filter identity [1 nil 2 false 3]) ;; => (1 2 3)

  ;; constantly — returns a function that always returns the same value
  ((constantly 42) 1 2 3)          ;; => 42
  (map (constantly :x) [1 2 3])    ;; => (:x :x :x)
)


;; ─────────────────────────────────────────────
;; SECTION 5 — complement, juxt, some, every?
;; ─────────────────────────────────────────────

(comment
  ;; complement — logical NOT of a predicate
  (def not-even? (complement even?))
  (filter not-even? [1 2 3 4 5])   ;; => (1 3 5)

  ;; juxt — call multiple functions on the same value, collect results
  ((juxt :name :role) {:name "Alice" :role :admin}) ;; => ["Alice" :admin]
  (map (juxt identity #(* % %)) [1 2 3 4 5])
  ;; => ([1 1] [2 4] [3 9] [4 16] [5 25])

  ;; some — return first truthy result of (f x), or nil
  (some even? [1 3 5 6 7])         ;; => true
  (some even? [1 3 5 7])           ;; => nil
  (some #(when (> % 3) %) [1 2 3 4 5]) ;; => 4

  ;; every? — true if (f x) is truthy for all elements
  (every? even? [2 4 6])           ;; => true
  (every? even? [2 4 5])           ;; => false

  ;; not-any? / not-every?
  (not-any?  odd? [2 4 6])         ;; => true
  (not-every? odd? [1 2 3])        ;; => true
)


;; ─────────────────────────────────────────────
;; SECTION 6 — sort, sort-by, group-by, frequencies
;; ─────────────────────────────────────────────

(def people
  [{:name "Carol" :age 32 :dept :eng}
   {:name "Alice" :age 28 :dept :design}
   {:name "Bob"   :age 35 :dept :eng}
   {:name "Dave"  :age 28 :dept :design}])

(comment
  ;; sort
  (sort [3 1 4 1 5 9 2 6])           ;; => (1 1 2 3 4 5 6 9)
  (sort > [3 1 4 1 5 9 2 6])         ;; => (9 6 5 4 3 2 1 1)
  (sort ["banana" "apple" "cherry"])  ;; => ("apple" "banana" "cherry")

  ;; sort-by — extract a key to sort on
  (sort-by :age  people)             ;; youngest first
  (sort-by :name people)             ;; alphabetical

  ;; group-by — partition into a map of lists
  (group-by :dept  people)           ;; => {:eng [...] :design [...]}
  (group-by :age   people)           ;; groups by age

  ;; frequencies
  (frequencies [:a :b :a :c :b :a]) ;; => {:a 3 :b 2 :c 1}

  ;; distinct — remove duplicates, preserve order
  (distinct [1 2 3 1 2 4])           ;; => (1 2 3 4)
)


;; ─────────────────────────────────────────────
;; SECTION 7 — Transducers
;; ─────────────────────────────────────────────
;;
;; Transducers are composable, reusable transformation pipelines.
;; They separate "what to transform" from "how to collect".
;; A transducer form (1-arg map/filter/etc) returns a transducer.

(comment
  ;; `into` with a transducer — transform while building a collection
  (into [] (map inc) [1 2 3 4 5])             ;; => [2 3 4 5 6]
  (into [] (filter even?) [1 2 3 4 5 6])      ;; => [2 4 6]

  ;; `comp` to chain transducers — applied LEFT-to-RIGHT (unlike fn comp)
  (into []
        (comp (filter odd?)
              (map #(* % %)))
        [1 2 3 4 5 6 7])
  ;; => [1 9 25 49]  (squares of odd numbers)

  ;; Compare: nested map+filter creates an intermediate sequence each step
  ;; Transducer chain processes each element in one pass — no intermediates

  ;; `transduce` — apply a transducer with reduce semantics
  (transduce (comp (filter odd?)
                   (map #(* % %)))
             +
             [1 2 3 4 5 6 7])
  ;; => 84  (sum of squares of odds)

  ;; `sequence` — lazy sequence from a transducer
  (sequence (comp (filter even?)
                  (map #(/ % 2)))
            (range 1 11))
  ;; => (1 2 3 4 5)

  ;; partition-all — group into chunks
  (into [] (partition-all 3) (range 10))
  ;; => [[0 1 2] [3 4 5] [6 7 8] [9]]

  ;; dedupe — remove consecutive duplicates
  (into [] (dedupe) [1 1 2 3 3 3 4 1])
  ;; => [1 2 3 4 1]

  ;; take as a transducer
  (into [] (take 3) (range 1000))
  ;; => [0 1 2]  (stops early, never touches rest of the range)
)
