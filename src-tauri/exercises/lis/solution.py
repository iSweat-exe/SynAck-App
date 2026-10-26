import sys

lines = sys.stdin.read().split("\n")
n = int(lines[0])
values = list(map(int, lines[1].split()))
best = [1] * n
for i in range(n):
    for j in range(i):
        if values[j] < values[i]:
            best[i] = max(best[i], best[j] + 1)
print(max(best))
