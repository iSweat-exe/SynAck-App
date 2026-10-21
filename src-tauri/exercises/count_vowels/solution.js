const lines = require("fs").readFileSync(0, "utf8").split("\n");
let count = 0;
for (const letter of lines[0].toLowerCase()) {
  if ("aeiouy".includes(letter)) count++;
}
console.log(count);
