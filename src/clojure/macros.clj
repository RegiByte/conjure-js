(ns clojure.core)

(defmacro defn [name params & body]
  `(def ~name (fn ~params ~@body)))

(defn next [coll]
  (seq (rest coll)))

(defmacro when [condition & body]
  `(if ~condition (do ~@body) nil))

(defmacro when-not [condition & body]
  `(if ~condition nil (do ~@body)))

(defmacro and [& forms]
  (if (nil? forms)
    true
    (if (nil? (seq (rest forms)))
      (first forms)
      `(let [v# ~(first forms)]
         (if v# (and ~@(rest forms)) v#)))))

(defmacro or [& forms]
  (if (nil? forms)
    nil
    (if (nil? (seq (rest forms)))
      (first forms)
      `(let [v# ~(first forms)]
         (if v# v# (or ~@(rest forms)))))))

(defmacro cond [& clauses]
  (if (nil? clauses)
    nil
    `(if ~(first clauses)
       ~(first (next clauses))
       (cond ~@(rest (rest clauses))))))

(defmacro -> [x & forms]
  (if (nil? forms)
    x
    (let [form (first forms)
          more (rest forms)
          threaded (if (list? form)
                     `(~(first form) ~x ~@(rest form))
                     `(~form ~x))]
      `(-> ~threaded ~@more))))

(defmacro ->> [x & forms]
  (if (nil? forms)
    x
    (let [form (first forms)
          more (rest forms)
          threaded (if (list? form)
                     `(~(first form) ~@(rest form) ~x)
                     `(~form ~x))]
      `(->> ~threaded ~@more))))

(defmacro comment
  ; Ignores body, yields nil
  [& body])

(defn constantly [x] (fn [& _] x))

(defn complement [f] (fn [& args] (not (apply f args))))

(defn not-any? [pred coll] (not (some pred coll)))

(defn not-every? [pred coll] (not (every? pred coll)))