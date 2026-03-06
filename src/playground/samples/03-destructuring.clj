(ns user.destructuring)

;; Deep Dive: Destructuring
;;
;; Destructuring lets you bind names to parts of a data structure in one step.
;; Works in `let`, `fn` params, `defn` params, `loop`, and `defmacro`.
;;
;; Press ⌘+Enter on any form to evaluate it.


;; ─────────────────────────────────────────────
;; SECTION 1 — Vector (Sequential) Destructuring
;; ─────────────────────────────────────────────
;;
;; Bind names to positions, left to right.

(comment
  ;; Basic positional binding
  (let [[a b c] [10 20 30]]
    (+ a b c))           ;; => 60

  ;; Skipping positions with _
  (let [[_ second _ fourth] [1 2 3 4]]
    [second fourth])     ;; => [2 4]

  ;; Fewer bindings than elements — extras are ignored
  (let [[a b] [1 2 3 4 5]]
    [a b])               ;; => [1 2]

  ;; & rest — bind remaining elements as a sequence
  (let [[first-item & the-rest] [1 2 3 4 5]]
    {:first first-item
     :rest  the-rest})   ;; => {:first 1 :rest (2 3 4 5)}

  ;; :as — bind the whole collection in addition to parts
  (let [[x y :as all] [1 2 3]]
    {:x x :y y :all all}) ;; => {:x 1 :y 2 :all [1 2 3]}

  ;; Nested vectors
  (let [[a [b c] d] [1 [2 3] 4]]
    [a b c d])           ;; => [1 2 3 4]
)


;; ─────────────────────────────────────────────
;; SECTION 2 — Map Destructuring
;; ─────────────────────────────────────────────
;;
;; Bind names to values by key.

(comment
  ;; Basic: bind local name to the value at a key
  (let [{n :name a :age} {:name "Alice" :age 30 :role :admin}]
    (str n " is " a))    ;; => "Alice is 30"

  ;; :keys — shorthand when local name == keyword name
  (let [{:keys [name age role]} {:name "Alice" :age 30 :role :admin}]
    [name age role])     ;; => ["Alice" 30 :admin]

  ;; :strs — like :keys but for string keys
  (let [{:strs [name age]} {"name" "Bob" "age" 25}]
    [name age])          ;; => ["Bob" 25]

  ;; :as — bind the whole map too
  (let [{:keys [name] :as person} {:name "Carol" :age 32}]
    {:greeting (str "Hello " name)
     :full     person}) ;; full map still available

  ;; :or — default values when key is absent (NOT when value is nil)
  (let [{:keys [name role] :or {role :guest}} {:name "Dave"}]
    [name role])         ;; => ["Dave" :guest]  (:role was absent)

  ;; :or does NOT apply when the key IS present but value is nil
  (let [{:keys [role] :or {role :guest}} {:role nil}]
    role)                ;; => nil  (key exists, :or doesn't fire)
)


;; ─────────────────────────────────────────────
;; SECTION 3 — Destructuring in Function Params
;; ─────────────────────────────────────────────

;; Vector destructuring in fn params
(defn sum-pair [[a b]]
  (+ a b))

;; Map destructuring in fn params
(defn greet-user [{:keys [name role] :or {role :guest}}]
  (str "Hello " name " (" (clojure.core/name role) ")"))

;; Multi-arg with map destructuring
(defn move [{:keys [x y]} {:keys [dx dy]}]
  {:x (+ x dx) :y (+ y dy)})

(comment
  (sum-pair [3 7])                         ;; => 10
  (greet-user {:name "Alice" :role :admin}) ;; => "Hello Alice (admin)"
  (greet-user {:name "Bob"})               ;; => "Hello Bob (guest)"
  (move {:x 0 :y 0} {:dx 3 :dy 5})        ;; => {:x 3 :y 5}
)


;; ─────────────────────────────────────────────
;; SECTION 4 — Nested Destructuring
;; ─────────────────────────────────────────────

(comment
  ;; Map inside vector
  (let [[{:keys [name]} {:keys [score]}]
        [{:name "Alice"} {:score 95}]]
    (str name ": " score))    ;; => "Alice: 95"

  ;; Vector inside map
  (let [{:keys [name]
         [first-score] :scores}
        {:name "Bob" :scores [87 90 95]}]
    (str name " first: " first-score)) ;; => "Bob first: 87"

  ;; Deeply nested — a realistic API response shape
  (def response
    {:status 200
     :body {:user {:id 42
                   :name "Alice"
                   :tags ["admin" "beta"]}}})

  (let [{:keys [status]
         {:keys [user]} :body} response
        {:keys [id name]
         [first-tag] :tags} user]
    {:status status :id id :name name :first-tag first-tag})
  ;; => {:status 200 :id 42 :name "Alice" :first-tag "admin"}
)


;; ─────────────────────────────────────────────
;; SECTION 5 — Destructuring in loop/recur
;; ─────────────────────────────────────────────

(comment
  ;; loop bindings are destructured the same as let
  (loop [[x & xs] [1 2 3 4 5]
         acc      0]
    (if x
      (recur xs (+ acc x))
      acc))                    ;; => 15

  ;; With a map
  (loop [{:keys [n acc]} {:n 5 :acc 1}]
    (if (zero? n)
      acc
      (recur {:n (dec n) :acc (* acc n)})))
  ;; => 120  (5!)
)


;; ─────────────────────────────────────────────
;; SECTION 6 — Kwargs Destructuring (& {:keys})
;; ─────────────────────────────────────────────
;;
;; A variadic `& rest` where rest is treated as a flat key/value sequence.
;; Clojure callers can pass keyword arguments naturally.

(defn configure [& {:keys [host port timeout]
                    :or   {host "localhost"
                           port 8080
                           timeout 5000}}]
  {:host host :port port :timeout timeout})

(comment
  (configure)                               ;; all defaults
  (configure :port 3000)                    ;; override port
  (configure :host "prod.example.com" :port 443 :timeout 30000)
)


;; ─────────────────────────────────────────────
;; SECTION 7 — Qualified :keys (Clojure 1.11)
;; ─────────────────────────────────────────────
;;
;; When map keys are namespaced keywords, use qualified :keys.
;; The local binding name is the unqualified part.

(comment
  (let [{:keys [user/name user/role]}
        {:user/name "Alice" :user/role :admin}]
    [name role])                            ;; => ["Alice" :admin]
)


;; ─────────────────────────────────────────────
;; SECTION 8 — Practical Patterns
;; ─────────────────────────────────────────────

;; Transform a collection of records
(defn summarize [{:keys [name scores]}]
  {:name    name
   :average (/ (reduce + scores) (count scores))
   :best    (apply max scores)})

(def students
  [{:name "Alice" :scores [88 92 95]}
   {:name "Bob"   :scores [75 80 78]}
   {:name "Carol" :scores [95 98 100]}])

(comment
  (map summarize students)

  ;; Destructure in a pipeline
  (->> students
       (map summarize)
       (sort-by :average >)
       (map :name))               ;; => ("Carol" "Alice" "Bob")

  ;; let* pattern — compute fields from destructured values
  (let [{:keys [scores]} (first students)
        [best & _] (sort > scores)]
    best)                         ;; => 95
)
