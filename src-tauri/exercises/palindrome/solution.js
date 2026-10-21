const lines = require("fs").readFileSync(0, "utf8").split("\n");
const word = lines[0];
const reversed = word.split("").reverse().join("");
console.log(word === reversed ? "oui" : "non");
