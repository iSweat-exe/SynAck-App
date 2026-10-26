C'est un **algorithme glouton** : on prend toujours autant que possible de la plus grande pièce, puis on passe à la suivante avec le reste. Pour ce jeu de pièces (50, 20, 10, 5, 2, 1), le glouton est optimal.

- **Piège** : n'affiche pas les pièces utilisées zéro fois.
- **Pour aller plus loin** : avec d'autres pièces, le glouton peut échouer (avec `1, 3, 4` pour rendre `6`, il donne `4+1+1` alors que `3+3` est meilleur). Il faut alors de la programmation dynamique.
