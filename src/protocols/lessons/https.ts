import type { Lesson } from "../types";

/** One lesson per subject of the quiz (`src-tauri/protocols/https.json`): what a question asks is taught here. */
export const httpsLessons: readonly Lesson[] = [
  {
    subject: "la différence entre HTTPS et HTTP",
    points: [
      "HTTPS n'est pas un protocole différent : c'est HTTP, avec les mêmes requêtes et les mêmes réponses, transporté à l'intérieur d'une connexion TLS.",
      "TLS ne remplace pas TCP : il s'ajoute par-dessus. HTTPS roule donc sur TLS, qui roule sur TCP.",
      "La seule différence visible est que les échanges sont chiffrés.",
      "HTTPS utilise le port 443 par défaut, et non le port 80, qui est celui d'HTTP.",
    ],
  },
  {
    subject: "le cadenas du navigateur",
    points: [
      "Le cadenas indique que la connexion est chiffrée et que le certificat est valide pour ce domaine.",
      "Il ne garantit pas que le site est honnête. Un site d'hameçonnage peut parfaitement afficher un cadenas, et un site avec un cadenas peut être malveillant.",
      "Le cadenas ne veut pas dire que le contenu a été vérifié par ton fournisseur d'accès, et il ne cache pas ton adresse IP aux sites visités.",
    ],
  },
  {
    subject: "l'ordre des opérations",
    points: [
      "Le navigateur interroge d'abord le DNS pour obtenir l'adresse, puis ouvre la connexion TCP, puis fait la poignée de main TLS, et envoie enfin la requête HTTP.",
      "TLS s'installe donc après TCP, jamais avant : il n'y a pas de HTTPS sans étape TCP.",
      "La requête HTTP part déjà chiffrée, jamais en clair. Le DNS est interrogé avant l'ouverture de la connexion, pas après l'envoi de la requête.",
    ],
  },
  {
    subject: "ce que voit un espion sur un Wi-Fi public",
    points: [
      "Un espion voit qu'une connexion existe et à quel serveur le navigateur parle. Il voit des octets illisibles à la place du contenu.",
      "Il ne voit pas l'adresse complète de la page demandée (seul le nom du site apparaît), ni les cookies, ni les mots de passe.",
      "Il ne peut pas modifier la page reçue sans que cela soit détecté.",
    ],
  },
  {
    subject: "les ports 80 et 443",
    points: [
      "Le port 443 est le port habituel d'HTTPS, le port 80 celui d'HTTP. Le port 22 est celui de SSH, pas d'HTTPS.",
      "Un serveur peut écouter sur les deux ports à la fois (souvent, le port 80 sert à rediriger vers le 443).",
      "Le navigateur choisit le port d'après le schéma de l'adresse : https:// mène au port 443, http:// au port 80. Le schéma change donc bien le port utilisé.",
    ],
  },
  {
    subject: "le certificat d'un site",
    points: [
      "Le certificat doit correspondre au nom de domaine visité : un même certificat ne convient pas à n'importe quel domaine.",
      "Un certificat expiré fait afficher un avertissement, il n'est pas accepté en silence.",
      "Il est délivré par une autorité de certification, pas par le navigateur lui-même.",
      "Le navigateur contient une liste d'autorités de confiance. Il ne fait pas confiance à une autorité inconnue.",
    ],
  },
  {
    subject: "ce que HTTPS ne protège pas",
    points: [
      "HTTPS protège le trajet entre toi et le site, rien de plus. L'adresse IP du serveur reste visible.",
      "Le site lui-même reçoit tes données en clair : il les déchiffre. HTTPS ne te rend donc pas anonyme auprès du site visité.",
      "Un site malveillant reste malveillant même en HTTPS, et HTTPS n'empêche pas l'hameçonnage d'exister.",
      "Un programme malveillant installé sur ton ordinateur voit tout : HTTPS ne protège pas contre un virus.",
    ],
  },
  {
    subject: "le coût d'HTTPS",
    points: [
      "HTTPS ajoute une poignée de main TLS à l'ouverture de la connexion. Avec TLS 1.3, elle coûte un seul aller-retour : moins que les versions précédentes.",
      "Une fois la connexion ouverte, elle peut servir à plusieurs requêtes : il ne faut pas refaire la poignée de main avant chaque requête.",
      "Le chiffrement ajoute peu de travail sur un ordinateur moderne. Il ne rend pas chaque requête dix fois plus lente, et n'exige pas un serveur spécialisé.",
    ],
  },
  {
    subject: "l'ouverture d'une connexion sécurisée vers un site",
    points: ["Les étapes, dans l'ordre :"],
    steps: [
      "Le navigateur interroge le DNS",
      "Le navigateur ouvre la connexion TCP",
      "La poignée de main TLS",
      "La requête HTTP chiffrée",
      "La réponse HTTP chiffrée",
    ],
  },
];
