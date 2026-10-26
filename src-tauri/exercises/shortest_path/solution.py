import heapq
import sys

lines = sys.stdin.read().split("\n")
n, m = map(int, lines[0].split())
graph = [[] for _ in range(n + 1)]
for k in range(m):
    a, b, length = map(int, lines[1 + k].split())
    graph[a].append((b, length))
    graph[b].append((a, length))
start, goal = map(int, lines[1 + m].split())

INF = float("inf")
dist = [INF] * (n + 1)
dist[start] = 0
queue = [(0, start)]
while queue:
    d, city = heapq.heappop(queue)
    if d > dist[city]:
        continue
    for neighbour, length in graph[city]:
        if d + length < dist[neighbour]:
            dist[neighbour] = d + length
            heapq.heappush(queue, (dist[neighbour], neighbour))
print(-1 if dist[goal] == INF else dist[goal])
