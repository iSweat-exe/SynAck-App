On convertit chaque ligne en liste d'entiers, puis on ajoute la deuxième à la fin de la première (`extend` en Python, décomposition `...` en JavaScript). La sortie est la liste puis sa longueur.

- **Piège** : une ligne vide doit donner une liste **vide**. En Python, `"".split(" ")` renvoie `['']` (un élément vide) alors que `"".split()` renvoie `[]`.
