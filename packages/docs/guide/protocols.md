# Protocols & Records

cljam implements `defprotocol`, `defrecord`, `extend-protocol`, and `extend-type`. The API is the same as JVM Clojure — the key difference is that dispatch uses **keyword type tags** instead of Java class names.

## Defining a protocol

```clojure
(defprotocol IArea
  (area [shape] "Compute the area")
  (perimeter [shape] "Compute the perimeter"))
```

## Defining records

```clojure
(defrecord Circle [radius])
(defrecord Rect [w h])
```

`defrecord` creates:
- A positional constructor: `(->Circle 5)`
- A map constructor: `(map->Circle {:radius 5})`
- Map-like access: `(:radius my-circle)`

## Extending the protocol

```clojure
(require '[clojure.math :as math])

(extend-protocol IArea
  :user/Circle
  (area [c] (* math/PI (:radius c) (:radius c)))
  (perimeter [c] (* 2 math/PI (:radius c)))

  :user/Rect
  (area [r] (* (:w r) (:h r)))
  (perimeter [r] (* 2 (+ (:w r) (:h r)))))

(area (->Circle 5))     ;; => 78.53981633974483
(area (->Rect 4 6))     ;; => 24
```

The type tag for a record is `:ns/RecordName`. For `Circle` defined in namespace `user`, the tag is `:user/Circle`.

## Type tags for built-ins

```clojure
(type "hello")    ;; => :string
(type 42)         ;; => :number
(type true)       ;; => :boolean
(type nil)        ;; => :nil
(type :foo)       ;; => :keyword
(type [1 2])      ;; => :vector
(type {:a 1})     ;; => :map
```

Use `type` when implementing protocols over built-in types:

```clojure
(extend-protocol ISerializable
  :string  (serialize [x] (str "\"" x "\""))
  :number  (serialize [x] (str x))
  :boolean (serialize [x] (str x))
  :nil     (serialize [_] "null"))
```

## extend-type

Extend multiple protocols on a single type in one form:

```clojure
(extend-type :user/Circle
  IArea
  (area [c] (* math/PI (:radius c) (:radius c)))

  IPrintable
  (pretty-print [c] (str "Circle(r=" (:radius c) ")")))
```

## Introspection

```clojure
(satisfies? IArea (->Circle 5))     ;; => true
(protocols (->Circle 5))            ;; => #{IArea IPrintable ...}
(extenders IArea)                   ;; => #{:user/Circle :user/Rect}
(record? (->Circle 5))              ;; => true
(record-type (->Circle 5))          ;; => "user/Circle"
```
