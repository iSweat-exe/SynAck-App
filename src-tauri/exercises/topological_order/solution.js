const lines = require("fs").readFileSync(0, "utf8").split("\n");
const [n, m] = lines[0].split(" ").map(Number);
const after = Array.from({ length: n + 1 }, () => []);
const indegree = new Array(n + 1).fill(0);
for (let k = 0; k < m; k++) {
  const [a, b] = lines[1 + k].split(" ").map(Number);
  after[a].push(b);
  indegree[b] += 1;
}

const ready = [];
for (let task = 1; task <= n; task++) {
  if (indegree[task] === 0) ready.push(task);
}
const order = [];
while (ready.length > 0) {
  ready.sort((x, y) => x - y);
  const task = ready.shift();
  order.push(task);
  for (const follower of after[task]) {
    indegree[follower] -= 1;
    if (indegree[follower] === 0) ready.push(follower);
  }
}
console.log(order.length === n ? order.join(" ") : "IMPOSSIBLE");
