const lines = require("fs").readFileSync(0, "utf8").split("\n");
const n = Number(lines[0]);
let result = 1;
for (let i = 2; i <= n; i++) {
  result *= i;
}
console.log(result);
