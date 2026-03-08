(ns user.collections)

;; Deep Dive: Collections
;;
;; Press ⌘+Enter on any form to evaluate it.


;; The Sequence Abstraction
;;
;; `seq` converts any collection (or string) into a sequence.
;; `first`, `rest`, `next`, `last`, `cons` all work on sequences.

(comment
  (seq [1 2 3])         ;; => (1 2 3)
  (seq {:a 1 :b 2})     ;; => ([:a 1] [:b 2])
  (seq "hello")         ;; => ("h" "e" "l" "l" "o")
  (seq [])              ;; => nil  (empty seq is nil!)
  (seq nil)             ;; => nil

  ;; first / rest / next
  (first [10 20 30])    ;; => 10
  (rest  [10 20 30])    ;; => (20 30)
  (next  [10 20 30])    ;; => (20 30)
  (next  [10])          ;; => nil   (next returns nil, rest returns ())
  (rest  [10])          ;; => ()
  (last  [10 20 30])    ;; => 30

  (second [10 20 30])   ;; => 20

  ;; cons — prepend an element to any sequence
  (cons 0 [1 2 3])      ;; => (0 1 2 3)
  (cons :x '(:y :z))    ;; => (:x :y :z)
)


;; Building Collections

(comment
  ;; conj — adds in the natural position for each type
  (conj [1 2 3] 4)          ;; => [1 2 3 4]     (vectors add to the END)
  (conj [1 2 3] 4 5 6)      ;; => [1 2 3 4 5 6]
  (conj '(1 2 3) 0)         ;; => (0 1 2 3)      (lists add to the FRONT)
  (conj {:a 1} [:b 2])      ;; => {:a 1 :b 2}

  ;; into — pour one collection into another
  (into [] '(1 2 3))        ;; => [1 2 3]
  (into '() [1 2 3])        ;; => (3 2 1)  (list adds to front)
  (into {} [[:a 1] [:b 2]]) ;; => {:a 1 :b 2}

  ;; constructors
  (vector 1 2 3)             ;; => [1 2 3]
  (list   1 2 3)             ;; => (1 2 3)
  (hash-map :a 1 :b 2)       ;; => {:a 1 :b 2}

  ;; range — lazy sequence of numbers
  (range 5)                  ;; => (0 1 2 3 4)
  (range 2 10)               ;; => (2 3 4 5 6 7 8 9)
  (range 0 20 3)             ;; => (0 3 6 9 12 15 18)

  (repeat 4 :x)              ;; => (:x :x :x :x)
  (concat [1 2] [3 4] [5])   ;; => (1 2 3 4 5)
  (zipmap [:a :b :c] [1 2 3]) ;; => {:a 1 :b 2 :c 3}
)


;; Inspecting Collections

(comment
  (count [1 2 3])       ;; => 3
  (count {:a 1 :b 2})   ;; => 2
  (count "hello")       ;; => 5

  ;; empty? — true when (seq coll) is nil
  (empty? [])           ;; => true
  (empty? [1])          ;; => false
  (empty? nil)          ;; => true

  ;; contains? — checks key existence (index for vectors)
  (contains? {:a 1 :b 2} :a)  ;; => true
  (contains? {:a 1 :b 2} :z)  ;; => false
  (contains? [10 20 30] 2)     ;; => true  (index 2 exists)

  (get {:a 1 :b 2} :a)          ;; => 1
  (get {:a 1 :b 2} :z)          ;; => nil
  (get {:a 1 :b 2} :z :missing) ;; => :missing  (default)
  (nth [10 20 30] 1)            ;; => 20
  (nth [10 20 30] 9 :oor)       ;; => :oor  (out-of-range default)

  (keys {:a 1 :b 2 :c 3})      ;; => (:a :b :c)
  (vals {:a 1 :b 2 :c 3})      ;; => (1 2 3)
)


;; Slicing & Windowing

(comment
  (take 3 [1 2 3 4 5 6])        ;; => (1 2 3)
  (drop 3 [1 2 3 4 5 6])        ;; => (4 5 6)

  (take-while even? [2 4 6 7 8 10]) ;; => (2 4 6)
  (drop-while even? [2 4 6 7 8 10]) ;; => (7 8 10)

  (take-last 2 [1 2 3 4 5])     ;; => (4 5)
  (drop-last 2 [1 2 3 4 5])     ;; => (1 2 3)

  (reverse [1 2 3 4 5])         ;; => (5 4 3 2 1)
)


;; Maps & Keywords as Functions (IFn)
;;
;; Maps and keywords are callable — they act as lookup functions.

(comment
  ;; Keyword as function — looks itself up in the map
  (:name {:name "Alice" :age 30})        ;; => "Alice"
  (:missing {:a 1} :default-value)       ;; => :default-value

  ;; Map as function — looks up the argument as a key
  ({:a 1 :b 2} :a)                       ;; => 1
  ({:a 1 :b 2} :z)                       ;; => nil
  ({:a 1 :b 2} :z 99)                    ;; => 99  (default)

  (def users
    [{:name "Alice" :role :admin}
     {:name "Bob"   :role :user}
     {:name "Carol" :role :admin}])

  (map :name users)                       ;; => ("Alice" "Bob" "Carol")
  (map :role users)                       ;; => (:admin :user :admin)

  (def admin? {:admin true :moderator true})
  (filter (comp admin? :role) users)      ;; => Alice and Carol

  (def catalog
    {:books  [{:title "SICP" :price 45}
              {:title "CTMCP" :price 38}]
     :videos [{:title "Structure" :price 0}]})

  (get-in catalog [:books 0 :title])      ;; => "SICP"
  (map :title (:books catalog))           ;; => ("SICP" "CTMCP")
)


;; Transforming Maps

(comment
  (assoc {:a 1} :b 2 :c 3)       ;; => {:a 1 :b 2 :c 3}
  (dissoc {:a 1 :b 2 :c 3} :b)   ;; => {:a 1 :c 3}

  (update {:count 0} :count inc)          ;; => {:count 1}
  (update {:scores [1 2]} :scores conj 3) ;; => {:scores [1 2 3]}

  ;; merge — rightmost wins on conflict
  (merge {:a 1 :b 2} {:b 99 :c 3})    ;; => {:a 1 :b 99 :c 3}
  (merge {:a 1} {:b 2} {:c 3})        ;; => {:a 1 :b 2 :c 3}

  (select-keys {:a 1 :b 2 :c 3 :d 4} [:a :c])  ;; => {:a 1 :c 3}

  ;; transform all values
  (into {}
        (map (fn [[k v]] [k (* v 2)])
             {:a 1 :b 2 :c 3}))   ;; => {:a 2 :b 4 :c 6}
)


;; Practical Patterns

(comment
  ;; Build a lookup map from a collection
  (def people
    [{:id 1 :name "Alice"}
     {:id 2 :name "Bob"}
     {:id 3 :name "Carol"}])

  (def by-id
    (into {} (map (fn [p] [(:id p) p]) people)))

  (get by-id 2)   ;; => {:id 2 :name "Bob"}

  ;; Or with zipmap
  (zipmap (map :id people) people)

  ;; Grouping
  (def items [:a :b :a :c :b :a])
  (frequencies items)             ;; => {:a 3 :b 2 :c 1}
  (group-by identity items)       ;; => {:a [:a :a :a] :b [:b :b] :c [:c]}

  (flatten [1 [2 [3 4]] [5]])     ;; => (1 2 3 4 5)
  (distinct [1 2 3 1 2 4 5 3])   ;; => (1 2 3 4 5)
)
