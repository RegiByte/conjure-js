(ns user.errors)

;; Deep Dive: Error Handling
;;
;; Press ⌘+Enter on any form to evaluate it.


;; try / catch / finally

(comment
  ;; No error — returns the value of the body
  (try
    (+ 1 2))           ;; => 3

  ;; catch with :default — catches anything
  (try
    (/ 1 0)
    (catch :default e
      (str "Caught: " (ex-message e))))

  ;; finally — always runs, does NOT change the return value
  (try
    (+ 1 2)
    (finally
      (println "always runs")))   ;; prints, returns 3

  (try
    (/ 1 0)
    (catch :default e
      (println "handling error")
      :recovered)
    (finally
      (println "cleanup")))       ;; => :recovered
)


;; throw
;;
;; You can throw any value — not just error objects.

(comment
  (try
    (throw "something went wrong")
    (catch string? e
      (str "got a string: " e)))

  (try
    (throw :not-found)
    (catch keyword? e
      (str "got a keyword: " e)))

  (try
    (throw 42)
    (catch number? e
      (str "got a number: " (+ e 1))))

  (try
    (throw {:type :validation :field :email :msg "invalid"})
    (catch map? e
      (str "validation error on " (:field e))))
)


;; Catch Discriminators
;;
;; The catch clause tests the thrown value with a discriminator:
;;
;;   :default        — catches everything
;;   :error/runtime  — catches evaluator errors (type errors, etc.)
;;   keyword         — checks (= thrown discriminator)
;;   predicate fn    — checks (pred thrown-value)

(comment
  (defn find-user [id]
    (if (pos? id)
      {:id id :name "Alice"}
      (throw :user/not-found)))

  (try
    (find-user -1)
    (catch :user/not-found _
      "User not found — check the id"))

  ;; Multiple catch clauses — matched in order
  (defn risky [x]
    (cond
      (string? x) (throw :bad-type)
      (neg?    x) (throw :negative)
      :else       (/ 100 x)))

  (try
    (risky -5)
    (catch :bad-type _  "wrong type")
    (catch :negative _  "negative number")
    (catch :default  e  (str "unexpected: " e)))

  (try (risky "oops") (catch :bad-type _ "wrong type") (catch :negative _ "neg"))
  (try (risky 0)      (catch :default e (ex-message e)))

  ;; :error/runtime — catches interpreter-level errors
  (try
    (+ 1 "not a number")
    (catch :error/runtime e
      (str "type error caught: " (ex-message e))))
)


;; ex-info: Structured Errors
;;
;; `ex-info` creates an error with a message AND a data map.

(comment
  (try
    (throw (ex-info "User validation failed"
                    {:field  :email
                     :value  "not-an-email"
                     :code   :invalid-format}))
    (catch :default e
      {:message (ex-message e)
       :data    (ex-data    e)}))

  ;; ex-info with a cause (chained errors)
  (try
    (try
      (/ 1 0)
      (catch :default cause
        (throw (ex-info "Database query failed"
                        {:query "SELECT *"}
                        cause))))
    (catch :default e
      {:message (ex-message e)
       :data    (ex-data    e)
       :cause   (ex-message (ex-cause e))}))
)


;; Keyword-typed Errors with ex-info
;;
;; Attach a :type keyword to the ex-info map, then catch by that keyword.

(defn parse-age [x]
  (cond
    (not (number? x))
    (throw (ex-info "Not a number" {:value x :type :error/parse}))

    (neg? x)
    (throw (ex-info "Age cannot be negative" {:value x :type :error/validation}))

    :else x))

(comment
  (try
    (parse-age "hello")
    (catch :error/parse e
      (str "Parse error: " (ex-message e) " (got: " (:value (ex-data e)) ")"))
    (catch :error/validation e
      (str "Validation error: " (ex-message e))))

  (try
    (parse-age -5)
    (catch :error/parse e      (str "parse: " (ex-message e)))
    (catch :error/validation e (str "validation: " (ex-message e))))

  (parse-age 30)               ;; => 30  (no error)
)


;; Practical Patterns

(comment
  ;; Result map {ok? result/error}
  (defn safe-divide [a b]
    (try
      {:ok? true  :result (/ a b)}
      (catch :default e
        {:ok? false :error (ex-message e)})))

  (safe-divide 10 2)   ;; => {:ok? true  :result 5}
  (safe-divide 10 0)   ;; => {:ok? false :error "..."}

  ;; Validate before computing
  (defn sqrt [n]
    (when (neg? n)
      (throw (ex-info "Cannot take sqrt of negative number"
                      {:value n :type :error/domain})))
    (loop [x (* 0.5 (+ 1.0 n))]
      (let [next-x (* 0.5 (+ x (/ n x)))
            diff   (max (- next-x x) (- x next-x))]
        (if (< diff 1e-9)
          next-x
          (recur next-x)))))

  (try (sqrt 9)  (catch :default e (ex-message e)))   ;; => 3.0
  (try (sqrt -1) (catch :error/domain e (ex-message e)))

  ;; Wrapping external errors with context
  (defn load-user [id]
    (try
      (if (= id 42)
        {:id 42 :name "Alice"}
        (throw (ex-info "User not found" {:id id :type :error/not-found})))
      (catch :error/not-found e
        (throw (ex-info (str "Failed to load profile for id=" id)
                        {:id id :type :error/load-failed}
                        e)))))

  (try
    (load-user 99)
    (catch :error/load-failed e
      {:msg    (ex-message e)
       :cause  (ex-message (ex-cause e))}))
)
