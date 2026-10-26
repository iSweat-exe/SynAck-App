On parcourt la liste en gardant un ensemble des valeurs **déjà vues** : un nombre n'est ajouté au résultat que la première fois qu'on le croise. L'ordre d'origine est ainsi conservé.

- **Piège** : `set(liste)` seul supprime les doublons mais ne garantit pas l'ordre d'origine.
