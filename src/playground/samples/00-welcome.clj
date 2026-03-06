(ns user
  (:require [clojure.string :as str]))

;; Welcome to the Regibyte Clojure Playground!
;;
;; HOW TO USE THIS FILE:
;;   ⌘+Enter  (Ctrl+Enter)        — evaluate the form under/before the cursor
;;   Shift+⌘+Enter                — evaluate the entire file
;;   "Run all" button             — same as Shift+⌘+Enter
;;
;; Forms inside (comment ...) blocks are safe to eval one by one.
;; Place your cursor inside any form and press ⌘+Enter.
;;
;; Select a topic from the dropdown above to load a deep-dive sample.


;; ─────────────────────────────────────────────
;; SECTION 1 — Primitives & Literals
;; ─────────────────────────────────────────────
;;
;; Every value in this language is an expression that evaluates to itself,
;; or to a computed result.  Primitives are the atoms.

(comment
  ;; Numbers
  42          ;; => 42
  3.14        ;; => 3.14
  -7          ;; => -7

  ;; Arithmetic — `+` `-` `*` `/` are plain functions
  (+ 1 2)     ;; => 3
  (* 6 7)     ;; => 42
  (/ 10 4)    ;; => 2.5
  (mod 17 5)  ;; => 2

  ;; Strings — always double-quoted
  "hello"               ;; => "hello"
  (str "hello" " " "world")  ;; => "hello world"
  (count "hello")       ;; => 5

  ;; Booleans
  true        ;; => true
  false       ;; => false
  (not true)  ;; => false

  ;; nil — the absence of a value
  nil         ;; => nil

  ;; Keywords — lightweight identifiers, evaluate to themselves
  :name       ;; => :name
  :user/role  ;; => :user/role  (namespaced keyword)
  (name :user/role)      ;; => "role"
  (namespace :user/role) ;; => "user"
)


;; ─────────────────────────────────────────────
;; SECTION 2 — Collections
;; ─────────────────────────────────────────────
;;
;; Four built-in collection types.  All are immutable — operations
;; always return new values, never mutate the original.

(comment
  ;; Vectors — ordered, indexed, literal syntax []
  [1 2 3]
  [:a :b :c]
  (conj [1 2 3] 4)      ;; => [1 2 3 4]
  (count [1 2 3])       ;; => 3
  (nth [10 20 30] 1)    ;; => 20

  ;; Lists — ordered, linked, literal syntax '()
  '(1 2 3)
  (first '(10 20 30))   ;; => 10
  (rest  '(10 20 30))   ;; => (20 30)
  (cons 0 '(1 2 3))     ;; => (0 1 2 3)

  ;; Maps — key/value pairs, literal syntax {}
  {:name "Alice" :age 30}
  (get {:name "Alice" :age 30} :name)  ;; => "Alice"
  (:age {:name "Alice" :age 30})       ;; => 30  (keywords are lookup fns)
  (assoc {:name "Alice"} :role :admin) ;; => {:name "Alice" :role :admin}
  (dissoc {:a 1 :b 2 :c 3} :b)        ;; => {:a 1 :c 3}

  ;; Nesting is natural
  (def user {:name "Bob"
             :scores [98 87 95]
             :address {:city "Austin" :zip "78701"}})

  (get-in user [:address :city])       ;; => "Austin"
  (update-in user [:scores] conj 100)  ;; adds 100 to :scores
)


;; ─────────────────────────────────────────────
;; SECTION 3 — Binding Values
;; ─────────────────────────────────────────────

(comment
  ;; `def` — bind a name at namespace scope
  (def pi 3.14159)
  (* 2 pi)           ;; => 6.28318...

  ;; `let` — local bindings, visible only inside the form
  (let [x 10
        y 20]
    (+ x y))         ;; => 30

  ;; Bindings can reference earlier ones in the same let
  (let [base  100
        bonus (* base 0.15)
        total (+ base bonus)]
    total)           ;; => 115.0

  ;; `do` — sequence multiple expressions, return last
  (do
    (println "side effect")
    42)              ;; prints "side effect", evaluates to 42
)


;; ─────────────────────────────────────────────
;; SECTION 4 — Functions
;; ─────────────────────────────────────────────

;; Functions are first-class values.  `defn` is the common shorthand.

(defn greet
  "Returns a greeting string."
  [name]
  (str "Hello, " name "!"))

(defn add
  "Adds two numbers."
  [a b]
  (+ a b))

(comment
  (greet "World")    ;; => "Hello, World!"
  (add 3 4)          ;; => 7

  ;; Anonymous functions with `fn`
  ((fn [x] (* x x)) 5)   ;; => 25

  ;; Shorthand #() — % is the first arg
  (#(* % %) 5)            ;; => 25
  (#(+ %1 %2) 3 4)        ;; => 7

  ;; Multi-arity — one `defn` handles different arg counts
  (defn hello
    ([]        (hello "World"))
    ([name]    (str "Hello, " name "!")))

  (hello)           ;; => "Hello, World!"
  (hello "Clojure") ;; => "Hello, Clojure!"

  ;; Variadic — `&` collects remaining args as a sequence
  (defn sum [& nums]
    (reduce + nums))

  (sum 1 2 3 4 5)   ;; => 15

  ;; Closures — functions capture their lexical environment
  (defn make-adder [n]
    (fn [x] (+ x n)))

  (def add10 (make-adder 10))
  (add10 5)         ;; => 15
  (add10 100)       ;; => 110
)


;; ─────────────────────────────────────────────
;; SECTION 5 — Control Flow
;; ─────────────────────────────────────────────
;;
;; Only `false` and `nil` are falsy.  Everything else (including 0 and "")
;; is truthy.

(comment
  ;; if
  (if true  "yes" "no")    ;; => "yes"
  (if false "yes" "no")    ;; => "no"
  (if nil   "yes" "no")    ;; => "no"
  (if 0     "yes" "no")    ;; => "yes"  (0 is truthy here!)

  ;; when — one-branch if, body wrapped in do
  (when true
    (println "runs")
    42)                      ;; => 42

  ;; cond — multiple branches
  (defn classify [n]
    (cond
      (neg? n)  :negative
      (zero? n) :zero
      (< n 10)  :small
      :else     :large))

  (classify -3)  ;; => :negative
  (classify 0)   ;; => :zero
  (classify 5)   ;; => :small
  (classify 99)  ;; => :large

  ;; and / or — short-circuit, return the deciding value
  (and 1 2 3)      ;; => 3  (last truthy)
  (and 1 false 3)  ;; => false
  (or false nil 42) ;; => 42  (first truthy)
)


;; ─────────────────────────────────────────────
;; SECTION 6 — Higher-Order Functions
;; ─────────────────────────────────────────────
;;
;; Functions are values — they can be passed as arguments and returned
;; as results.

(comment
  ;; map — apply a function to every element, return a new sequence
  (map inc [1 2 3 4 5])            ;; => (2 3 4 5 6)
  (map #(* % %) [1 2 3 4])         ;; => (1 4 9 16)
  (map str [:a :b :c])             ;; => ("a" "b" "c")

  ;; filter — keep elements where predicate returns true
  (filter even? [1 2 3 4 5 6])     ;; => (2 4 6)
  (filter pos?  [-3 -1 0 2 4])     ;; => (2 4)

  ;; reduce — fold a collection into a single value
  (reduce + [1 2 3 4 5])           ;; => 15
  (reduce + 100 [1 2 3])           ;; => 106  (100 is the initial value)
  (reduce conj [] '(1 2 3))        ;; => [1 2 3]  (list → vector)

  ;; apply — call a function with a collection as its argument list
  (apply + [1 2 3 4])              ;; => 10
  (apply str ["a" "b" "c"])        ;; => "abc"

  ;; comp — compose functions right-to-left
  (def shout (comp str/upper-case str/trim))
  (shout "  hello ")               ;; => "HELLO"

  ;; partial — partially apply a function
  (def double (partial * 2))
  (map double [1 2 3 4])           ;; => (2 4 6 8)
)


;; ─────────────────────────────────────────────
;; SECTION 7 — Threading Macros
;; ─────────────────────────────────────────────
;;
;; Threading macros pipe a value through a chain of transformations,
;; making data-processing pipelines easy to read.

(comment
  ;; -> threads the value as the FIRST argument
  (-> "  hello world  "
      str/trim
      str/upper-case
      (str/split #" "))
  ;; => ["HELLO" "WORLD"]

  ;; ->> threads the value as the LAST argument
  (->> [1 2 3 4 5 6 7 8 9 10]
       (filter odd?)
       (map #(* % %))
       (reduce +))
  ;; => sum of squares of odd numbers 1-10 => 165

  ;; Without threading (hard to read):
  (reduce + (map #(* % %) (filter odd? [1 2 3 4 5 6 7 8 9 10])))
)


;; ─────────────────────────────────────────────
;; SECTION 8 — Data Transformation
;; ─────────────────────────────────────────────

(def game
  {:name       "Colt Express"
   :categories ["Family" "Strategy"]
   :play-time  40
   :ratings    {:alice 5 :bob 4 :carol 5}})

(comment
  ;; assoc — add or replace a key
  (assoc game :play-time 45)
  (assoc game :age-from 10)

  ;; dissoc — remove keys
  (dissoc game :ratings)

  ;; update — transform a value with a function
  (update game :play-time + 5)             ;; play-time => 45
  (update game :categories conj "Co-op")   ;; add category

  ;; merge — combine maps (rightmost wins on conflict)
  (merge {:a 1 :b 2} {:b 99 :c 3})        ;; => {:a 1 :b 99 :c 3}

  ;; select-keys
  (select-keys game [:name :play-time])

  ;; assoc-in / update-in / get-in for nested paths
  (assoc-in  game [:ratings :dave] 3)
  (update-in game [:ratings :bob] inc)
  (get-in    game [:ratings :alice])       ;; => 5

  ;; Pipelines with ->
  (-> game
      (assoc  :play-time 50)
      (update :categories conj "Card")
      (dissoc :ratings))
)


;; ─────────────────────────────────────────────
;; SECTION 9 — Strings
;; ─────────────────────────────────────────────

(comment
  ;; String construction
  (str "Hello" ", " "World" "!")        ;; => "Hello, World!"
  (str/join ", " ["one" "two" "three"]) ;; => "one, two, three"
  (str/join ["H" "e" "l" "l" "o"])      ;; => "Hello"

  ;; Inspection
  (count "hello")                        ;; => 5
  (str/upper-case "hello")               ;; => "HELLO"
  (str/lower-case "WORLD")               ;; => "world"
  (str/trim "  hello  ")                 ;; => "hello"

  ;; Search
  (str/includes?   "hello world" "world") ;; => true
  (str/starts-with? "hello" "hel")        ;; => true
  (str/ends-with?   "hello" "llo")        ;; => true

  ;; Slicing and splitting
  (subs "hello world" 6)                 ;; => "world"
  (subs "hello world" 0 5)               ;; => "hello"
  (str/split "a,b,c" #",")              ;; => ["a" "b" "c"]

  ;; Replace
  (str/replace "hello world" "world" "Clojure") ;; => "hello Clojure"
  (str/replace "hello" #"[aeiou]" "*")          ;; => "h*ll*"
)


;; ─────────────────────────────────────────────
;; SECTION 10 — Atoms (Mutable State)
;; ─────────────────────────────────────────────
;;
;; Atoms are the one sanctioned place for mutable state.
;; `swap!` applies a function to the current value atomically.

(def counter (atom 0))
(def cart    (atom []))

(comment
  ;; deref with @ to read the current value
  @counter                     ;; => 0

  ;; swap! — apply fn to current value, store result
  (swap! counter inc)          ;; => 1
  (swap! counter inc)          ;; => 2
  (swap! counter + 10)         ;; => 12
  @counter                     ;; => 12

  ;; reset! — overwrite unconditionally
  (reset! counter 0)
  @counter                     ;; => 0

  ;; More realistic: a cart
  (swap! cart conj {:item "apple" :qty 2})
  (swap! cart conj {:item "bread" :qty 1})
  @cart
)


;; ─────────────────────────────────────────────
;; SECTION 11 — Error Handling
;; ─────────────────────────────────────────────

(comment
  ;; try / catch / finally
  (try
    (/ 1 0)
    (catch :default e
      (str "caught: " (ex-message e))))

  ;; throw any value — catch with a predicate or :default
  (try
    (throw 42)
    (catch number? e
      (str "got a number: " e)))

  ;; ex-info — structured errors with a data map
  (try
    (throw (ex-info "Something went wrong"
                    {:code :not-found :id 99}))
    (catch :default e
      {:message (ex-message e)
       :data    (ex-data e)}))

  ;; finally always runs
  (try
    (+ 1 2)
    (finally
      (println "cleanup")))     ;; prints "cleanup", returns 3
)


;; ─────────────────────────────────────────────
;; SECTION 12 — Macros & Metaprogramming
;; ─────────────────────────────────────────────

(comment
  ;; defmacro — define a macro that transforms code before evaluation
  (defmacro unless [test & body]
    `(when (not ~test)
       ~@body))

  (unless false
    (println "false is falsy")
    42)       ;; => 42

  ;; macroexpand — see what a macro produces
  (macroexpand '(when true (println "hi")))
  ;; => (if true (do (println "hi")))

  (macroexpand-all '(-> x str/trim str/upper-case))
  ;; shows the fully expanded threading chain
)


;; ─────────────────────────────────────────────
;; WHAT'S NEXT?
;; ─────────────────────────────────────────────
;;
;; Select a topic from the dropdown for a deep dive:
;;
;;   Collections          — seq, conj, into, range, map/keyword as IFn
;;   Higher-Order Fns     — map/filter/reduce depth, comp/juxt, transducers
;;   Destructuring        — vector, map, :keys, :or, nested, kwargs
;;   Strings & Regex      — clojure.string API, regex literals, re-find/re-seq
;;   Error Handling       — try/catch patterns, ex-info, discriminators
