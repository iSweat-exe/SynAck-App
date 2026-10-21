import sys

lines = sys.stdin.read().split("\n")
counts = {}
for word in lines[0].split():
    counts[word] = counts.get(word, 0) + 1
for word in sorted(counts):
    print(f"{word}: {counts[word]}")
