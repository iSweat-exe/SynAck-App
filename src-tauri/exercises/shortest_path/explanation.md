On utilise l'**algorithme de Dijkstra**. On garde la meilleure distance connue de chaque ville, puis on traite à chaque fois la ville non traitée la plus proche : comme toutes les longueurs sont positives, sa distance est alors définitive. On met à jour ses voisines, et on recommence.

- **Pièges** : les routes sont à double sens ; plusieurs routes peuvent relier les mêmes villes (on garde la plus courte, naturellement) ; l'arrivée peut être inaccessible (`-1`) ou égale au départ (`0`).
- **Complexité** : en choisissant la ville la plus proche par simple recherche, `n²`. Avec une file de priorité, plus rapide sur de grands réseaux.
