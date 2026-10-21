---
id: "okf-logical-clocks-02"
title: "Logical Clocks and Causal Consistency"
description: "Foundational theory of Lamport timestamps, vector clocks, and event causality in distributed algorithms"
author: "Open Knowledge Foundation - Distributed Systems Working Group"
version: "1.0.0"
tags:
  - "distributed-systems"
  - "logical-clocks"
  - "causality"
  - "vector-clocks"
created_at: "2026-02-10T00:00:00Z"
updated_at: "2026-10-18T00:00:00Z"
sources:
  - title: "Time, Clocks, and the Ordering of Events in a Distributed System"
    authors: ["Leslie Lamport"]
    year: 1978
  - title: "Virtual Time and Global States of Distributed Systems"
    authors: ["Friedemann Mattern"]
    year: 1988
license: "CC-BY-4.0"
---

# Logical Clocks and Causal Consistency

## 1. The Asynchronous Causal Ordering Problem
Without synchronized physical clocks (e.g. atomic clocks or GPS synchronization), distributed nodes cannot order events simply by local wall-clock measurements.

## 2. Happened-Before Relation ($\to$)
The partial order $\to$ on the set of events represents potential causal influence:
- Program order: Intra-process event ordering.
- Message order: Send event precedes corresponding receive event.
- Transitive closure: If $A \to B$ and $B \to C$, then $A \to C$.

## 3. Vector Clock Property
A vector clock $V$ guarantees the bi-directional causal theorem:
$$V(A) < V(B) \iff A \to B$$
This allows distributed systems to detect concurrency ($A \parallel B$) whenever neither timestamp dominates the other.
