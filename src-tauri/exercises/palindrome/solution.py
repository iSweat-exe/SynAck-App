import sys

lines = sys.stdin.read().split("\n")
word = lines[0]
print("oui" if word == word[::-1] else "non")
