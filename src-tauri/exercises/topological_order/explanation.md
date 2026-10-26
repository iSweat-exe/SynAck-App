C'est un **tri topologique** (algorithme de Kahn). On compte les prérequis restants de chaque tâche. On garde l'ensemble des tâches disponibles (zéro prérequis), on prend la plus petite, on la retire, puis on décrémente le compteur de ses suivantes : celles qui tombent à zéro deviennent disponibles.

- **Cycle** : si le résultat contient moins de `n` tâches à la fin, certaines ne sont jamais devenues disponibles, donc les contraintes se contredisent : `IMPOSSIBLE`.
- **Piège** : le choix de la plus petite tâche disponible se refait à **chaque** étape, pas seulement au début.
