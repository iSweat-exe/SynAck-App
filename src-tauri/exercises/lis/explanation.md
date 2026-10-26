On calcule `best[i]`, la longueur de la plus longue sous-suite croissante qui **se termine** à l'élément `i`. Elle vaut `1 + max(best[j])` pour les `j < i` dont la valeur est strictement plus petite. La réponse est le **maximum** de `best`.

- **Piège** : « strictement » croissante, donc deux valeurs égales ne se suivent pas.
- **Complexité** : cette version coûte `n²`. Une version en `n log n` existe (on garde, pour chaque longueur, la plus petite fin possible, avec une recherche dichotomique).
