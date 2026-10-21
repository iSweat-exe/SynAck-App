import sys

lines = sys.stdin.read().split("\n")
k = int(lines[0])
total = 0
for line in lines[1 : k + 1]:
    addition, pourcentage = map(int, line.split())
    total += addition * pourcentage / 100
print(f"Total des pourboires : {total:.2f} €")
