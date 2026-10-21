const lines = require("fs").readFileSync(0, "utf8").split("\n");
const numbers = lines[1].split(" ").filter(Boolean).map(Number);
let best = numbers[0];
for (const n of numbers) {
  if (n > best) best = n;
}
console.log(best);
