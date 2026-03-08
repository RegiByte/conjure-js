(ns demo
  (:require [demo.math :refer [pi square factorial] :as m]))

(def greeting "Hello from Clojure!")


greeting
(def add m/add)

(add 1 2)

(slurp "test.txt")

(doc reduce)

(defn greet [name]
  (str greeting " Welcome, " name "!"))

(greet "Regibyte")

(defn fibonacci [n]
  (loop [i 0 a 0 b 1]
    (if (= i n)
      a
      (recur (inc i) b (+ a b)))))

(map fibonacci [1 2 3 4 5 6])

(+ 1 2)

(println "Hello World!" "From Calva!!!!!!")

(type {:this-is :awesome!})

(when true
  (println "Yes\n")
  (println "This\n")
  (println "Is working!")
  42)


(map inc [2 3 4 5 8 2])
