const lines = require("fs").readFileSync(0, "utf8").split("\n");
const counts = {};
for (const word of lines[0].split(" ")) {
  counts[word] = (counts[word] ?? 0) + 1;
}
for (const word of Object.keys(counts).sort()) {
  console.log(`${word}: ${counts[word]}`);
}
