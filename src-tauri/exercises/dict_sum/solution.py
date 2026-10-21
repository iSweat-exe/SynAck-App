import sys

lines = sys.stdin.read().split("\n")
k = int(lines[0])
d = {}
for line in lines[1 : k + 1]:
    key, value = line.split()
    d[key] = int(value)
print(sum(d.values()))
