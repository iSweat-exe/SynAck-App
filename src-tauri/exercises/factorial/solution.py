import sys

lines = sys.stdin.read().split("\n")
n = int(lines[0])
result = 1
for i in range(2, n + 1):
    result *= i
print(result)
