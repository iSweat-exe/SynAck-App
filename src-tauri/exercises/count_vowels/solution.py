import sys

lines = sys.stdin.read().split("\n")
count = 0
for letter in lines[0].lower():
    if letter in "aeiouy":
        count += 1
print(count)
