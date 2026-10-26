const lines = require("fs").readFileSync(0, "utf8").split("\n");
const [n, capacity] = lines[0].split(" ").map(Number);
const best = new Array(capacity + 1).fill(0);
for (let k = 0; k < n; k++) {
  const [weight, value] = lines[1 + k].split(" ").map(Number);
  for (let room = capacity; room >= weight; room--) {
    best[room] = Math.max(best[room], best[room - weight] + value);
  }
}
console.log(best[capacity]);
