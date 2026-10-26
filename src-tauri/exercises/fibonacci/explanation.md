On n'a besoin que des **deux derniers termes** : `a` et `b`. À chaque tour, on range `a` dans le résultat, puis on décale : `a` prend la valeur de `b` et `b` devient `a + b`.

- **Complexité** : une seule boucle, donc proportionnelle à `n`.
- **Piège** : la version récursive `fib(n) = fib(n-1) + fib(n-2)` recalcule les mêmes termes des milliers de fois et devient très lente. Garder deux variables évite tout cela.
