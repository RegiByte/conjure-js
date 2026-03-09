(ns webrepl
  (:require [math :as m]
            [clojure.string :as str]))

(println "Hello World!")

(println '(m/add 3 5) " -> " (m/add 3 5))

(+ 1 2)

when


(/ 2 3)
(try
  (/ 2 0)
  (catch :default e
    (println "Failed here bro" e)))

(comment
  (println "Hello from calva")


  (/ 2 0)
  (def x 10)
  (println x)

  (println "this is nice!")

  (println (+ 1 2 3 4 6))
  (println '(+ 1 2 3 4 6 5))
  (clojure.string/join "--" ["Foo" "Bar" "Baz" "Nice!"])

  ;
  )

(defn factorial
  "The factorial function"
  [n]
  (loop [i n acc 1]
    (if (<= i 1)
      acc
      (recur (dec i) (* acc i)))))

(def foo "bar")

(println foo)

(comment
  (println "Hello Claude!")
  (doc m/add)
  (doc factorial)

  (println (macroexpand-all
            '(let [x 0
                   y 1
                   s (+ x y)
                   msg (cond
                         (zero? s) 0
                         (> s 2) "s is greater than 2"
                         (< s 0) "s is less than 0"
                         :else "Something else")]
               (println msg)
               msg)))
  (doc reduce)

  (meta #'m/add))
