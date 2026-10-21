# CS452 Distributed Systems — Lecture 4: Consensus and the Raft Algorithm

## 1. The Consensus Problem
In distributed systems, consensus is the problem of reaching agreement among multiple nodes on a single value or state machine transition, even in the presence of unreliable networks and server crashes.

### Key Invariants and Safety Guarantees:
1. **Election Safety**: At most one leader can be elected in a given term ($Term\ t$). Since each server can cast at most one vote per term (first-come, first-served) and an elected leader must receive votes from a strict majority ($\lfloor n/2 \rfloor + 1$ out of $n$ nodes), two distinct majorities must overlap by at least one node.
2. **Leader Append-Only**: A leader never overwrites or truncates its own log entries; it only appends new entries.
3. **Log Matching Property**: If two logs contain an entry with the same index and term, then they store the same command and their logs are identical in all entries up through the given index.
4. **Leader Completeness**: If a log entry is committed in a given term, then that entry will be present in the logs of the leaders for all higher-numbered terms.
5. **State Machine Safety**: If a server has applied a log entry at a given index to its state machine, no other server will ever apply a different log entry for the same index.

## 2. Raft Leader Election Mechanism
- Nodes exist in one of three states: **Follower**, **Candidate**, or **Leader**.
- Followers expect periodic heartbeats (`AppendEntries` RPC with empty payload).
- If an election timeout fires (randomized between 150ms – 300ms to prevent split votes), the follower transitions to candidate, increments its current term, votes for itself, and sends `RequestVote` RPCs to all peers.
- If split votes occur where no candidate secures a majority, the randomized election timer ensures one candidate will time out and start a new term first.

## 3. Joint Consensus & Cluster Membership Changes
To change cluster configuration safely (e.g., adding or removing nodes), Raft uses a two-phase joint consensus approach:
- Configuration $C_{old,new}$ requires agreement from both old majority and new majority simultaneously.
- Once $C_{old,new}$ is committed, the leader commits $C_{new}$.
