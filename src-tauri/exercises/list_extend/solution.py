import sys

lines = sys.stdin.read().split("\n")
liste = [int(x) for x in lines[0].split()]
liste.extend(int(x) for x in lines[1].split())
print(" ".join(map(str, liste)))
print(len(liste))
