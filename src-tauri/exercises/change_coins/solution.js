const lines = require("fs").readFileSync(0, "utf8").split("\n");
let remaining = Number(lines[0]);
for (const coin of [50, 20, 10, 5, 2, 1]) {
  const count = Math.floor(remaining / coin);
  remaining -= count * coin;
  if (count > 0) console.log(`${coin}: ${count}`);
}
