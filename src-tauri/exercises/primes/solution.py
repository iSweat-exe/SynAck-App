import sys

lines = sys.stdin.read().split("\n")
n = int(lines[0])
primes = []
for candidate in range(2, n + 1):
    is_prime = True
    for divisor in range(2, candidate):
        if candidate % divisor == 0:
            is_prime = False
            break
    if is_prime:
        primes.append(candidate)
print(" ".join(map(str, primes)))
