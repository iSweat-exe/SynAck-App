const lines = require("fs").readFileSync(0, "utf8").split("\n");
const words = lines[0].split(" ");
console.log(words.reverse().join(" "));
