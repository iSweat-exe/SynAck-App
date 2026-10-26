Les nombres décimaux ne sont pas exacts en machine (`0.1 + 0.2` n'est pas `0.3`). On travaille donc en **centimes entiers** : une addition de `A` euros avec `p` % de pourboire donne `A × p` centimes. On additionne tous ces entiers, puis on met en forme : euros = `total // 100`, centimes = `total % 100` sur deux chiffres.

- **Piège** : oublier le zéro des centimes (`8.9` au lieu de `8.90`).
