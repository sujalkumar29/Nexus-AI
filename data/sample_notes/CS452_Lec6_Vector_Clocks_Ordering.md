# CS452 Distributed Systems — Lecture 6: Logical Clocks, Vector Clocks, and Causality

## 1. Physical vs. Logical Time
Physical clocks drift due to quartz crystal instability (clock skew and drift). In asynchronous distributed networks, physical clocks cannot be relied upon to establish precise causal relationships between distributed events.

## 2. Lamport Timestamps & Partial Ordering
Leslie Lamport defined the **Happened-Before relation** ($\to$):
- If events $a$ and $b$ are in the same process and $a$ occurs before $b$, then $a \to b$.
- If $a$ is sending a message and $b$ is the receipt of that message, then $a \to b$.
- If $a \to b$ and $b \to c$, then $a \to c$ (transitivity).
- If neither $a \to b$ nor $b \to a$, then $a$ and $b$ are **concurrent** ($a \parallel b$).

### Lamport Clock Limitation:
If $L(a) < L(b)$, we **cannot** conclude that $a \to b$. Lamport clocks provide total ordering by breaking ties with process IDs, but they lose causal independence.

## 3. Vector Clocks
A vector clock for a system of $N$ processes is an array $V$ of $N$ logical clocks.
Each process $P_i$ maintains $V_i[1..N]$:
- Before executing an internal event, $P_i$ increments $V_i[i] = V_i[i] + 1$.
- When sending a message $m$, $P_i$ attaches its current vector $V_i$.
- Upon receiving $(m, V_{msg})$, process $P_j$ updates:
  $$V_j[k] = \max(V_j[k], V_{msg}[k]) \quad \forall k \in [1..N]$$
  and increments its own local entry $V_j[j] = V_j[j] + 1$.

### Strong Causal Equivalence:
$$V(a) < V(b) \iff a \to b$$
Two events are concurrent ($a \parallel b$) if and only if neither $V(a) \le V(b)$ nor $V(b) \le V(a)$.
Matrix clocks extend vector clocks to track what other processes know about other processes' vector clocks, which is useful for distributed checkpointing and message log compaction.
