import sys

lines = sys.stdin.read().split("\n")
remaining = int(lines[0])
for coin in [50, 20, 10, 5, 2, 1]:
    count = remaining // coin
    remaining -= count * coin
    if count > 0:
        print(f"{coin}: {count}")
