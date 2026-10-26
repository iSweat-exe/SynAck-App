Une lettre devient un numéro (`a` = 0 … `z` = 25), on ajoute le décalage, puis on revient dans l'alphabet avec un **modulo 26**, et on retransforme le numéro en lettre. Les espaces sont recopiés tels quels.

- **Piège** : sans le modulo, `x` décalé de 3 sort de l'alphabet au lieu de revenir à `a`.
