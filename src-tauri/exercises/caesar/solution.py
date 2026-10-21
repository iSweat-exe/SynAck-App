import sys

lines = sys.stdin.read().split("\n")
shift = int(lines[0])
result = ""
for char in lines[1]:
    if char == " ":
        result += char
    else:
        result += chr((ord(char) - ord("a") + shift) % 26 + ord("a"))
print(result)
