import sys

lines = sys.stdin.read().split("\n")
a = lines[0]
b = lines[1] if len(lines) > 1 else ""
previous = list(range(len(b) + 1))
for i in range(1, len(a) + 1):
    current = [i] + [0] * len(b)
    for j in range(1, len(b) + 1):
        cost = 0 if a[i - 1] == b[j - 1] else 1
        current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    previous = current
print(previous[len(b)])
