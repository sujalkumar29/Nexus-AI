# CS452 Distributed Systems — Lecture 7: Byzantine Fault Tolerance (BFT)

## 1. Crash Faults vs. Byzantine Faults
- **Crash Fault Tolerance (CFT)** (e.g., Paxos, Raft): Nodes either operate correctly or stop completely. Nodes are honest and do not send contradictory or malicious messages. Requires $N \ge 2f + 1$ nodes to tolerate $f$ crash faults.
- **Byzantine Fault Tolerance (BFT)**: Nodes may fail arbitrarily, act maliciously, collude, or send conflicting messages to different peers (two-faced behavior).

## 2. Theoretical Lower Bound for BFT Consensus
In an asynchronous or partially synchronous system with unauthenticated messages, reaching consensus under $f$ Byzantine nodes requires:
$$N \ge 3f + 1$$
Strictly speaking, the number of faulty nodes must satisfy:
$$f < \frac{N}{3}$$

### Proof Intuition:
Suppose there are $N$ nodes, $f$ of which are Byzantine.
1. The system must make progress even if $f$ nodes are unresponsive (since an asynchronous network cannot distinguish between a slow node and a dead node). Therefore, the quorum size must be at most $N - f$.
2. Within any responding quorum of $N - f$ nodes, up to $f$ nodes could actually be Byzantine liars.
3. To ensure that the honest nodes in the quorum outnumber the Byzantine nodes, we must have:
   $$(N - f) - f > f \implies N > 3f \implies N \ge 3f + 1$$

## 3. Practical Byzantine Fault Tolerance (PBFT)
Castro & Liskov's PBFT algorithm provides state machine replication under Byzantine failures:
1. **Pre-Prepare Phase**: Primary node assigns a monotonic sequence number $n$ to client request $m$ and broadcasts `<<PRE-PREPARE, v, n, d>, m>`.
2. **Prepare Phase**: Backups verify digest $d$ and broadcast `<PREPARE, v, n, d, i>`. A node attains `prepared(m, v, n, i)` once it collects $2f$ matching prepare messages from distinct nodes.
3. **Commit Phase**: Nodes broadcast `<COMMIT, v, n, d, i>` and commit upon collecting $2f + 1$ commit messages.
