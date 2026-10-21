const lines = require("fs").readFileSync(0, "utf8").split("\n");
const k = Number(lines[0]);
let total = 0;
for (const line of lines.slice(1, k + 1)) {
  const [addition, pourcentage] = line.split(" ").map(Number);
  total += (addition * pourcentage) / 100;
}
console.log(`Total des pourboires : ${total.toFixed(2)} €`);
