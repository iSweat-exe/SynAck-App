import type { Lesson } from "../types";

/** One lesson per subject of the quiz (`src-tauri/protocols/udp.json`): what a question asks is taught here. */
export const udpLessons: readonly Lesson[] = [
  {
    subject: "la connexion",
    points: [
      "UDP n'ouvre aucune connexion avant d'envoyer : pas de poignée de main, ni en deux ni en trois temps, et pas de message de fermeture comme le FIN de TCP.",
      "Le premier paquet envoyé contient déjà des données.",
      "Un client n'a pas besoin d'être accepté d'abord : un serveur UDP peut recevoir un datagramme de n'importe quel client.",
      "UDP ne garde aucun état de la conversation : chaque datagramme est traité indépendamment des autres.",
    ],
  },
  {
    subject: "la fiabilité",
    points: [
      "UDP n'envoie aucun accusé de réception, ne renvoie jamais un datagramme perdu et ne prévient personne de la perte. L'expéditeur ne sait donc pas si son message est arrivé.",
      "Un datagramme peut aussi arriver en double.",
      "Si une application veut de la fiabilité avec UDP, c'est à elle de la construire : accusés, renvois, numérotation.",
    ],
  },
  {
    subject: "l'ordre des datagrammes",
    points: [
      "Chaque datagramme voyage seul. Deux datagrammes peuvent arriver dans un autre ordre que celui d'envoi, et UDP ne remet jamais d'ordre.",
      "UDP ne numérote pas les octets et ne forme pas un flux continu comme TCP : un datagramme ne dépend pas du précédent et se lit indépendamment.",
      "Une application qui a besoin de l'ordre doit numéroter elle-même ses messages.",
    ],
  },
  {
    subject: "les usages d'UDP",
    points: [
      "Le DNS utilise surtout UDP pour ses requêtes.",
      "Les appels vidéo et la voix préfèrent UDP : une image en retard ne sert plus à rien, mieux vaut passer à la suivante.",
      "Les jeux en ligne utilisent souvent UDP pour sa faible latence.",
      "QUIC, qui porte HTTP/3, est construit sur UDP.",
      "À l'inverse, ce qui doit absolument arriver passe par TCP : le web classique (HTTP/1.1), SSH, le courrier électronique, les transferts importants.",
    ],
  },
  {
    subject: "l'en-tête UDP",
    points: [
      "L'en-tête UDP est très court : 8 octets, donc bien plus léger que celui de TCP.",
      "Il ne contient que quatre champs : le port d'origine, le port de destination, la longueur et la somme de contrôle.",
      "Il n'y a ni numéro de séquence ni fenêtre de réception : ce sont des champs de TCP. L'adresse IP du destinataire n'est pas non plus dans l'en-tête UDP, elle est dans l'en-tête IP.",
    ],
  },
  {
    subject: "la somme de contrôle",
    points: [
      "La somme de contrôle permet de détecter un datagramme abîmé en route. Un datagramme dont la somme est fausse est jeté : il n'est jamais remis à l'application.",
      "Elle ne répare rien : elle détecte l'erreur, sans la corriger, et ne retrouve pas des données perdues.",
      "Elle ne chiffre rien, et ne protège pas contre une modification volontaire : un attaquant peut recalculer la somme.",
      "Elle ne garantit pas non plus qu'un datagramme arrive : un datagramme peut toujours se perdre.",
    ],
  },
  {
    subject: "la comparaison avec TCP",
    points: [
      "UDP n'attend aucune confirmation, ce qui réduit les délais, et il ajoute moins d'informations que TCP à chaque message.",
      "UDP n'est donc pas toujours plus lent : il est plus léger, mais il n'offre pas les mêmes garanties que TCP.",
      "UDP ne vérifie pas que le destinataire est prêt, et il ne ralentit pas quand le réseau est saturé : il n'a ni contrôle de flux ni contrôle de congestion.",
      "Il convient quand une donnée en retard devient inutile. C'est l'application qui décide de renvoyer ou non.",
    ],
  },
  {
    subject: "les ports en UDP",
    points: [
      "UDP utilise des ports, comme TCP, pour distinguer les programmes d'une machine.",
      "Le port habituel du DNS est le 53, pas le 80 (celui d'HTTP). Le 53 est dédié au DNS, pas au courrier électronique.",
      "Les ports UDP et les ports TCP forment deux espaces séparés : le port UDP 53 et le port TCP 53 sont deux choses distinctes, qui peuvent même être utilisées par deux programmes différents. Un même numéro ne désigne donc pas forcément le même programme.",
    ],
  },
  {
    subject: "un échange en UDP",
    points: ["Les événements d'un échange, dans l'ordre chronologique :"],
    steps: [
      "Le client envoie le datagramme",
      "Le datagramme traverse le réseau",
      "Le serveur reçoit le datagramme",
      "Le serveur répond par un nouveau datagramme",
    ],
  },
  {
    subject: "ce qui arrive à un datagramme perdu",
    points: ["Ce qui se passe quand un datagramme se perd, dans l'ordre chronologique :"],
    steps: [
      "Le client envoie le datagramme",
      "Le datagramme se perd en route",
      "Personne n'est prévenu",
      "L'application décide de renvoyer ou d'abandonner",
    ],
  },
];
