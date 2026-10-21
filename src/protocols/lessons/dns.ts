import type { Lesson } from "../types";

/** One lesson per subject of the quiz (`src-tauri/protocols/dns.json`): what a question asks is taught here. */
export const dnsLessons: readonly Lesson[] = [
  {
    subject: "le rôle du DNS",
    points: [
      "Le DNS traduit un nom de domaine (example.com) en adresse IP. C'est un annuaire : on donne le nom, il rend l'adresse.",
      "On l'interroge avant d'ouvrir la connexion vers un site, puisqu'il faut l'adresse pour s'y connecter.",
      "Il ne stocke aucune page web et ne chiffre rien : un échange DNS classique est en clair.",
      "Un même nom peut correspondre à plusieurs adresses, par exemple pour répartir la charge entre plusieurs serveurs. Un nom ne correspond donc pas toujours à une seule adresse.",
    ],
  },
  {
    subject: "le résolveur",
    points: [
      "Le résolveur est le serveur qui mène l'enquête à la place du navigateur. Le navigateur ne parle qu'à lui, jamais directement aux serveurs racine.",
      "Il est souvent fourni par le fournisseur d'accès, ou choisi par l'utilisateur (1.1.1.1, par exemple). Ce n'est pas un serveur propre à un site web.",
      "Il garde les réponses en cache pour ne pas refaire l'enquête à chaque fois.",
      "Il ne détient pas toutes les adresses du monde : quand il n'a pas la réponse, il interroge d'autres serveurs.",
    ],
  },
  {
    subject: "les serveurs racine",
    points: [
      "Les serveurs racine sont tout en haut de la hiérarchie du DNS. Ils ne connaissent l'adresse d'aucun site : ils savent seulement qui gère chaque extension (.com, .fr…) et renvoient vers les serveurs de cette extension.",
      "Le résolveur les interroge en premier quand sa mémoire ne suffit pas. Il ne les interroge pas pour chaque page chargée : grâce au cache, il les sollicite rarement, et jamais en dernier.",
      "Ils n'appartiennent pas à l'entreprise du site visité : ils font partie de l'infrastructure d'Internet.",
    ],
  },
  {
    subject: "les serveurs de TLD",
    points: [
      "TLD veut dire « extension » : .com, .fr, .org. Un serveur de TLD gère toute une extension, pas un seul site.",
      "Il est interrogé après la racine et avant le serveur faisant autorité. Il n'est jamais interrogé avant la racine ni après le serveur faisant autorité.",
      "Il ne connaît pas l'adresse finale du site : il indique quels serveurs font autorité pour le domaine demandé.",
    ],
  },
  {
    subject: "le serveur faisant autorité",
    points: [
      "C'est le dernier maillon de la résolution, jamais le premier serveur interrogé. Il détient la vraie réponse pour un domaine, mais pas pour tous les domaines.",
      "Il est géré par le propriétaire du domaine ou par son hébergeur DNS. Il n'est pas choisi au hasard à chaque requête.",
      "Sa réponse est accompagnée d'une durée de validité, le TTL : elle n'est donc pas valable pour toujours.",
    ],
  },
  {
    subject: "le cache et le TTL",
    points: [
      "Le TTL est la durée, en secondes, pendant laquelle une réponse peut être gardée en cache. Ce n'est pas un nombre de serveurs.",
      "Pendant cette durée, le résolveur répond directement, sans refaire toute l'enquête. Une fois la durée écoulée, la réponse n'est plus valable et il faut la redemander : il n'y a pas de délai de grâce.",
      "Un TTL court permet de changer plus vite d'adresse, parce que les caches se renouvellent plus vite. Un TTL long retarde la propagation d'un changement.",
      "Le cache n'est pas vidé à chaque page visitée : c'est justement lui qui rend la plupart des requêtes instantanées.",
    ],
  },
  {
    subject: "les types d'enregistrements",
    points: [
      "Un enregistrement A associe un nom à une adresse IPv4. Un enregistrement AAAA associe un nom à une adresse IPv6, et ne contient jamais de mot de passe : A n'est donc pas pour l'IPv6.",
      "Un enregistrement MX indique le serveur qui reçoit le courrier du domaine. Il ne concerne pas l'hébergement des pages web.",
      "Un enregistrement CNAME est un alias : il fait d'un nom un autre nom pour le même site. Il ne donne pas directement une adresse IP, il renvoie vers un autre nom qu'il faut encore résoudre.",
    ],
  },
  {
    subject: "le transport du DNS",
    points: [
      "Une requête DNS classique passe en UDP sur le port 53, et pas en TCP sur le port 443 ni sur le port 22. UDP n'est pas interdit pour le DNS : c'est son choix par défaut.",
      "TCP prend le relais quand la réponse est trop grosse pour tenir dans un datagramme.",
      "Une requête DNS classique n'est pas chiffrée : un observateur du réseau voit les noms demandés.",
      "DNS over HTTPS envoie les requêtes dans une connexion HTTPS, ce qui cache leur contenu à un observateur du réseau.",
    ],
  },
  {
    subject: "la résolution d'un nom sans cache",
    points: ["Quand le résolveur n'a rien en cache, les événements s'enchaînent ainsi :"],
    steps: [
      "Le navigateur interroge le résolveur",
      "Le résolveur interroge un serveur racine",
      "Le résolveur interroge le serveur du TLD",
      "Le résolveur interroge le serveur faisant autorité",
      "Le résolveur renvoie l'adresse au navigateur",
    ],
  },
  {
    subject: "les serveurs interrogés pour trouver une adresse",
    points: ["On descend la hiérarchie, du plus général au plus précis :"],
    steps: ["La racine", "Le serveur du TLD", "Le serveur faisant autorité"],
  },
];
