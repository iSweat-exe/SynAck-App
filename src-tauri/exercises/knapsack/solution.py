import sys

lines = sys.stdin.read().split("\n")
n, capacity = map(int, lines[0].split())
best = [0] * (capacity + 1)
for k in range(n):
    weight, value = map(int, lines[1 + k].split())
    for room in range(capacity, weight - 1, -1):
        best[room] = max(best[room], best[room - weight] + value)
print(best[capacity])
