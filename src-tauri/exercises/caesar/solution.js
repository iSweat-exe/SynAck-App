const lines = require("fs").readFileSync(0, "utf8").split("\n");
const shift = Number(lines[0]);
let result = "";
for (const char of lines[1]) {
  if (char === " ") {
    result += char;
  } else {
    result += String.fromCharCode(((char.charCodeAt(0) - 97 + shift) % 26) + 97);
  }
}
console.log(result);
