import sys

lines = sys.stdin.read().split("\n")
seen = []
for number in lines[0].split():
    if number not in seen:
        seen.append(number)
print(" ".join(seen))
