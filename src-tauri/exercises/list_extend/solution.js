const lines = require("fs").readFileSync(0, "utf8").split("\n");
const toNumbers = (line) => line.split(" ").filter(Boolean).map(Number);
const liste = [...toNumbers(lines[0]), ...toNumbers(lines[1])];
console.log(liste.join(" "));
console.log(liste.length);
