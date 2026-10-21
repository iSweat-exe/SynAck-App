const lines = require("fs").readFileSync(0, "utf8").split("\n");
const seen = [];
for (const number of lines[0].split(" ")) {
  if (!seen.includes(number)) seen.push(number);
}
console.log(seen.join(" "));
