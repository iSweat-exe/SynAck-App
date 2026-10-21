import sys

lines = sys.stdin.read().split("\n")
words = lines[0].split()
print(" ".join(reversed(words)))
