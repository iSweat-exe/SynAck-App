const lines = require("fs").readFileSync(0, "utf8").split("\n");
const [n, m] = lines[0].split(" ").map(Number);
const graph = Array.from({ length: n + 1 }, () => []);
for (let k = 0; k < m; k++) {
  const [a, b, length] = lines[1 + k].split(" ").map(Number);
  graph[a].push([b, length]);
  graph[b].push([a, length]);
}
const [start, goal] = lines[1 + m].split(" ").map(Number);

const dist = new Array(n + 1).fill(Infinity);
const done = new Array(n + 1).fill(false);
dist[start] = 0;
for (;;) {
  let city = -1;
  for (let v = 1; v <= n; v++) {
    if (!done[v] && dist[v] !== Infinity && (city === -1 || dist[v] < dist[city])) city = v;
  }
  if (city === -1) break;
  done[city] = true;
  for (const [neighbour, length] of graph[city]) {
    dist[neighbour] = Math.min(dist[neighbour], dist[city] + length);
  }
}
console.log(dist[goal] === Infinity ? -1 : dist[goal]);
