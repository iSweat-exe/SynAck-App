const lines = require("fs").readFileSync(0, "utf8").split("\n");
const n = Number(lines[0]);
let a = 0;
let b = 1;
const terms = [];
for (let i = 0; i < n; i++) {
  terms.push(a);
  [a, b] = [b, a + b];
}
console.log(terms.join(" "));
