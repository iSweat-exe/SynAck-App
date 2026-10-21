import sys

lines = sys.stdin.read().split("\n")
numbers = [int(x) for x in lines[1].split()]
best = numbers[0]
for n in numbers:
    if n > best:
        best = n
print(best)
