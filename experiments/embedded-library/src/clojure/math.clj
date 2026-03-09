(ns math)

(println "Math lodule loaded")

(defn add
  "Adds two numbers together"
  [x y] (+ x y))

(add 1 2)

(println (add 1 2))

(doc +)

(doc macroexpand)