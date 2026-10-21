---
id: "okf-consensus-invariants-01"
title: "Distributed Consensus and Raft Protocol Invariants"
description: "Formal principles of consensus, leader election safety, and log replication in distributed state machines"
author: "Open Knowledge Foundation - Distributed Systems Working Group"
version: "1.0.0"
tags:
  - "distributed-systems"
  - "consensus"
  - "raft"
  - "fault-tolerance"
created_at: "2026-02-01T00:00:00Z"
updated_at: "2026-10-15T00:00:00Z"
sources:
  - title: "In Search of an Understandable Consensus Algorithm"
    authors: ["Diego Ongaro", "John Ousterhout"]
    year: 2014
  - title: "Paxos Made Simple"
    authors: ["Leslie Lamport"]
    year: 2001
license: "CC-BY-4.0"
---

# Distributed Consensus and Raft Protocol Invariants

## Core Principles
A distributed consensus algorithm enables a set of independent server nodes to agree upon a shared sequence of inputs or state transitions even if individual communication channels drop packets or individual nodes crash.

### Fundamental Safety Theorems
1. **Election Safety**: For any given election term $T$, there is at most one leader elected ($|\text{Leaders}(T)| \le 1$). Because node majorities strictly intersect ($\lceil (N+1)/2 \rceil + \lceil (N+1)/2 \rceil > N$), conflicting majorities cannot independently form in the same term.
2. **Log Invariance**: If two servers agree on an entry at index $k$ with term $t$, all previous log entries from $1$ to $k-1$ are identical.
3. **Commitment Monotonicity**: Once an entry is committed by a majority of servers in term $T$, it cannot be displaced by subsequent elections.
