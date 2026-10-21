const lines = require("fs").readFileSync(0, "utf8").split("\n");
const n = Number(lines[0]);
const primes = [];
for (let candidate = 2; candidate <= n; candidate++) {
  let isPrime = true;
  for (let divisor = 2; divisor < candidate; divisor++) {
    if (candidate % divisor === 0) {
      isPrime = false;
      break;
    }
  }
  if (isPrime) primes.push(candidate);
}
console.log(primes.join(" "));
