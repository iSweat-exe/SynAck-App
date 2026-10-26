const lines = require("fs").readFileSync(0, "utf8").split("\n");
const n = Number(lines[0]);
const values = lines[1].split(" ").map(Number);
const best = new Array(n).fill(1);
for (let i = 0; i < n; i++) {
  for (let j = 0; j < i; j++) {
    if (values[j] < values[i]) best[i] = Math.max(best[i], best[j] + 1);
  }
}
console.log(Math.max(...best));
