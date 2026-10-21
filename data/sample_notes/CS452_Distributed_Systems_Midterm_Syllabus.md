# CS452 Distributed Systems — Midterm Exam Syllabus & High-Yield Blueprint

## Course Information
- **Course**: CS452 Distributed Systems (Senior Undergraduate / Master's Level)
- **Exam Date**: Friday, October 24, 2026 (09:00 AM – 11:30 AM)
- **Exam Format**: Closed-book, 10 advanced conceptual MCQs + 3 proofs / system trace analyses

## High-Yield Exam Modules & Priority Weights:
1. **Consensus Architecture & Raft Protocol (Priority: 98% / CRITICAL)**
   - Leader election safety, split-vote resolution, election timeouts
   - Log matching invariant, committed entries safety, joint consensus
2. **Logical Clocks, Vector Clocks & Causal Ordering (Priority: 94% / HIGH)**
   - Lamport Happened-Before relation, transitivity, concurrent events
   - Vector timestamp comparison theorem: $V(a) < V(b) \iff a \to b$
   - Total ordering vs causal ordering, Matrix clocks
3. **Byzantine Fault Tolerance & Replicated State Machines (Priority: 89% / HIGH)**
   - Theoretical lower bound: $N \ge 3f + 1$, proof rationale
   - PBFT three-phase commit (Pre-Prepare, Prepare, Commit), View changes
