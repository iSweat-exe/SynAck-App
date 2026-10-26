import heapq
import sys

lines = sys.stdin.read().split("\n")
n, m = map(int, lines[0].split())
after = [[] for _ in range(n + 1)]
indegree = [0] * (n + 1)
for k in range(m):
    a, b = map(int, lines[1 + k].split())
    after[a].append(b)
    indegree[b] += 1

ready = [task for task in range(1, n + 1) if indegree[task] == 0]
heapq.heapify(ready)
order = []
while ready:
    task = heapq.heappop(ready)
    order.append(task)
    for follower in after[task]:
        indegree[follower] -= 1
        if indegree[follower] == 0:
            heapq.heappush(ready, follower)
print(" ".join(map(str, order)) if len(order) == n else "IMPOSSIBLE")
