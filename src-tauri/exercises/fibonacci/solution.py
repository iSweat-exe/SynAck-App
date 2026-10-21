import sys

lines = sys.stdin.read().split("\n")
n = int(lines[0])
a, b = 0, 1
terms = []
for _ in range(n):
    terms.append(a)
    a, b = b, a + b
print(" ".join(map(str, terms)))
