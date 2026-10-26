Pour chaque nombre, les tests se font **du plus précis au plus général** : divisible par 15 (donc par 3 et 5), puis par 3, puis par 5, sinon le nombre lui-même.

- **Piège** : tester `% 3` avant `% 15` fait afficher `Fizz` pour 15, et `FizzBuzz` n'apparaît jamais.
