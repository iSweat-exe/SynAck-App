C'est de la **programmation dynamique**. On note `d[i][j]` la distance entre les `i` premières lettres du premier mot et les `j` premières du second. Chaque case ne dépend que de trois voisines : supprimer (`d[i-1][j] + 1`), insérer (`d[i][j-1] + 1`) ou remplacer (`d[i-1][j-1] + coût`). On prend le minimum.

- **Complexité** : `len(a) × len(b)` cases, contre une explosion exponentielle si on essayait toutes les suites d'opérations.
- **Mémoire** : une ligne ne dépend que de la précédente, deux lignes suffisent.
- **Piège** : un des mots peut être vide, la distance est alors la longueur de l'autre.
