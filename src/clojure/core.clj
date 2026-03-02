(ns clojure.core)

(defmacro defn [name & fdecl]
  (let [doc       (if (string? (first fdecl)) (first fdecl) nil)
        rest-decl (if doc (rest fdecl) fdecl)]
    (if doc
      `(def ~name (with-meta (fn ~@rest-decl) {:doc ~doc}))
      `(def ~name (fn ~@rest-decl)))))

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

;; ── Transducer protocol ──────────────────────────────────────────────────────

;; into: 2-arity uses reduce+conj; 3-arity uses transduce
(defn into
  ([to from] (reduce conj to from))
  ([to xf from] (transduce xf conj to from)))

;; sequence: materialise a transducer over a collection into a vector
(defn sequence
  ([coll] (into [] coll))
  ([xf coll] (into [] xf coll)))

;; map: 1-arg returns transducer; 2-arg is eager
(defn map
  ([f]
   (fn [rf]
     (fn
       ([] (rf))
       ([result] (rf result))
       ([result input] (rf result (f input))))))
  ([f coll]
   (sequence (map f) coll)))

;; filter: 1-arg returns transducer; 2-arg is eager
(defn filter
  ([pred]
   (fn [rf]
     (fn
       ([] (rf))
       ([result] (rf result))
       ([result input]
        (if (pred input)
          (rf result input)
          result)))))
  ([pred coll]
   (sequence (filter pred) coll)))

;; take-while: stateless transducer; emits reduced when pred fails
(defn take-while
  ([pred]
   (fn [rf]
     (fn
       ([] (rf))
       ([result] (rf result))
       ([result input]
        (if (pred input)
          (rf result input)
          (reduced result))))))
  ([pred coll]
   (sequence (take-while pred) coll)))

;; drop-while: stateful transducer; passes through once pred fails
(defn drop-while
  ([pred]
   (fn [rf]
     (let [dropping (volatile! true)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (if (and @dropping (pred input))
            result
            (do
              (vreset! dropping false)
              (rf result input))))))))
  ([pred coll]
   (sequence (drop-while pred) coll)))

;; take: stateful transducer; signals early termination after n items
;; r > 0 → keep going; r = 0 → take last item and stop; r < 0 → already past limit, stop
(defn take
  ([n]
   (fn [rf]
     (let [remaining (volatile! n)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (let [r (vswap! remaining dec)]
            (if (> r 0)
              (rf result input)
              (if (= r 0)
                (ensure-reduced (rf result input))
                (reduced result)))))))))
  ([n coll]
   (sequence (take n) coll)))

;; drop: stateful transducer; skips first n items
;; r >= 0 → still skipping; r < 0 → past the drop zone, start taking
(defn drop
  ([n]
   (fn [rf]
     (let [remaining (volatile! n)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (let [r (vswap! remaining dec)]
            (if (>= r 0)
              result
              (rf result input))))))))
  ([n coll]
   (sequence (drop n) coll)))

;; map-indexed: stateful transducer; passes index and item to f
(defn map-indexed
  ([f]
   (fn [rf]
     (let [idx (volatile! 0)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (let [i @idx]
            (vswap! idx inc)
            (rf result (f i input))))))))
  ([f coll]
   (sequence (map-indexed f) coll)))

;; dedupe: stateful transducer; removes consecutive duplicates
(defn dedupe
  ([]
   (fn [rf]
     (let [prev (volatile! nil)
           has-prev (volatile! false)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (let [prior @prev
                had @has-prev]
            (vreset! prev input)
            (vreset! has-prev true)
            (if (and had (= prior input))
              result
              (rf result input))))))))
  ([coll]
   (sequence (dedupe) coll)))

;; partition-all: stateful transducer; groups items into vectors of size n
(defn partition-all
  ([n]
   (fn [rf]
     (let [buf (volatile! [])]
       (fn
         ([] (rf))
         ([result]
          (let [b @buf]
            (vreset! buf [])
            (if (empty? b)
              (rf result)
              (rf (unreduced (rf result b))))))
         ([result input]
          (let [nb (conj @buf input)]
            (if (= (count nb) n)
              (do
                (vreset! buf [])
                (rf result nb))
              (do
                (vreset! buf nb)
                result))))))))
  ([n coll]
   (sequence (partition-all n) coll)))

;; ── Documentation ────────────────────────────────────────────────────────────

(defmacro doc [sym]
  `(let [v# ~sym
         d# (:doc (meta v#))]
     (if d#
       (println d#)
       (println "No documentation available."))))
