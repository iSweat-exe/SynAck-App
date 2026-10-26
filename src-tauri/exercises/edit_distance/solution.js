const lines = require("fs").readFileSync(0, "utf8").split("\n");
const a = lines[0];
const b = lines[1] ?? "";
let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
for (let i = 1; i <= a.length; i++) {
  const current = [i];
  for (let j = 1; j <= b.length; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
  }
  previous = current;
}
console.log(previous[b.length]);
