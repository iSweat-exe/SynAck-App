const lines = require("fs").readFileSync(0, "utf8").split("\n");
const k = Number(lines[0]);
const d = {};
for (const line of lines.slice(1, k + 1)) {
  const [key, value] = line.split(" ");
  d[key] = Number(value);
}
console.log(Object.values(d).reduce((sum, v) => sum + v, 0));
