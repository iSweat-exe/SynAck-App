C'est le **problème du sac à dos 0/1**, résolu par programmation dynamique. `meilleur[c]` est la valeur maximale pour une capacité `c`. Pour chaque objet, on met à jour `meilleur[c]` en comparant « ne pas le prendre » et « le prendre » (`meilleur[c - poids] + valeur`).

- **Piège essentiel** : on parcourt les capacités de la **plus grande à la plus petite**. Dans l'autre sens, un objet pourrait être pris plusieurs fois (ce serait le sac à dos non borné).
- **Pourquoi pas le glouton** : trier par valeur / poids ne donne pas toujours le meilleur résultat.
- **Complexité** : `n × capacité`, contre `2^n` en essayant toutes les combinaisons.
