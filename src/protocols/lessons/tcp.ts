import type { Lesson } from "../types";

/** One lesson per subject of the quiz (`src-tauri/protocols/tcp.json`): what a question asks is taught here. */
export const tcpLessons: readonly Lesson[] = [
  {
    subject: "la poignée de main en trois temps",
    points: [
      "Avant d'échanger des données, le client et le serveur ouvrent la connexion avec trois messages : SYN, SYN-ACK, puis ACK. C'est donc une poignée de main en trois temps, pas en deux.",
      "C'est toujours le client qui parle le premier, avec le SYN. Le serveur, lui, attend en écoute.",
      "Dans le SYN et dans le SYN-ACK, chaque côté annonce le numéro de séquence par lequel il commence. Ce numéro n'est pas toujours 0 : chaque côté choisit le sien et l'annonce dans ce message.",
      "Une fois le troisième message envoyé, les deux côtés passent à l'état ESTABLISHED : la connexion est ouverte.",
      "La poignée de main ne chiffre rien. TCP ne protège pas le contenu : c'est le rôle de TLS, qui s'ajoute par-dessus.",
    ],
  },
  {
    subject: "les accusés de réception",
    points: [
      "À chaque envoi, le destinataire répond par un accusé de réception (ACK) qui confirme ce qui est bien arrivé : tout, jusqu'à un certain octet.",
      "Le numéro d'acquittement désigne le prochain octet attendu, et non le dernier reçu. « ack = 1501 » veut dire : j'ai tout reçu jusqu'à l'octet 1500, envoie la suite à partir du 1501.",
      "Un ACK est la confirmation normale, envoyée tout le temps, pas seulement quand une erreur est détectée. Un seul ACK peut confirmer plusieurs segments reçus d'un coup.",
      "Un ACK ne demande jamais de renvoyer quoi que ce soit. C'est l'absence d'accusé qui déclenche un renvoi : un segment qui n'est pas acquitté est renvoyé après un délai.",
    ],
  },
  {
    subject: "la perte d'un paquet",
    points: [
      "Quand un segment n'est pas acquitté avant la fin d'un délai, l'expéditeur le renvoie : c'est la retransmission. TCP détecte et corrige tout seul. L'application n'est pas prévenue et n'a rien à faire.",
      "Le délai avant renvoi double à chaque échec. Il augmente donc : il ne diminue pas et ne reste pas fixe.",
      "Il n'y a pas à recommencer la poignée de main : seul le segment perdu est renvoyé, avec les mêmes octets.",
      "Grâce à cela, l'application qui lit reçoit toujours les octets dans l'ordre et sans trou.",
    ],
  },
  {
    subject: "la fermeture d'une connexion",
    points: [
      "On ferme proprement avec des messages FIN, chacun acquitté par un ACK. Cela fait en général quatre messages : FIN, ACK, FIN, ACK. Le RST, lui, est une coupure brutale, pas une fermeture propre.",
      "Chaque sens se ferme séparément. Après le FIN du client, le serveur peut encore envoyer des données, jusqu'à ce qu'il envoie son propre FIN. Fermer un sens ne ferme donc pas l'autre.",
      "Celui qui ferme le premier finit à l'état TIME_WAIT : il attend un moment pour pouvoir renvoyer le dernier ACK si le FIN du serveur lui est renvoyé. Cela n'a rien à voir avec du chiffrement.",
    ],
  },
  {
    subject: "les numéros de séquence",
    points: [
      "TCP numérote les octets, un par un, et non les paquets. Le numéro d'un segment est celui de son premier octet.",
      "Chaque sens de la connexion a sa propre numérotation : le client numérote ses octets, le serveur numérote les siens.",
      "Ces numéros servent à remettre les données dans l'ordre et à repérer un segment reçu en double (même numéro qu'un segment déjà reçu).",
      "Ils ne chiffrent rien, et ils ne repartent pas à 1 à chaque segment : ils continuent de grandir tout au long de la connexion.",
    ],
  },
  {
    subject: "ce que TCP garantit",
    points: [
      "TCP garantit que les données arrivent dans l'ordre où elles ont été envoyées, que les données perdues sont renvoyées, et que l'application ne reçoit aucun octet en double.",
      "L'ordre ne dépend pas de la vitesse de chaque paquet : TCP remet de l'ordre avant de livrer les données à l'application.",
      "Ce qu'il promet, c'est la fiabilité, pas la vitesse : aucun délai maximum n'est garanti, une livraison peut prendre plus d'une seconde.",
      "Il ne peut pas empêcher le réseau de perdre des paquets : ils se perdent, puis TCP les répare par un renvoi.",
      "Il ne chiffre rien : les données restent lisibles pour qui les intercepte.",
    ],
  },
  {
    subject: "les états d'une connexion",
    points: [
      "Le serveur qui attend des clients est à l'état LISTEN. Il n'est pas ESTABLISHED tant qu'aucune connexion n'est ouverte.",
      "Quand le client envoie son SYN, il passe à l'état SYN_SENT. Le client n'est jamais en LISTEN.",
      "Quand le serveur reçoit le SYN, c'est lui qui passe à SYN_RECEIVED. Cet état est celui du serveur, pas celui du client.",
      "Après le troisième message de la poignée de main, les deux côtés sont ESTABLISHED. Cet état n'apparaît donc qu'après la poignée de main, jamais avant le premier SYN.",
      "CLOSED veut dire qu'il n'y a plus de connexion.",
    ],
  },
  {
    subject: "les ports",
    points: [
      "L'adresse IP désigne une machine, le port désigne un programme sur cette machine. Un port n'identifie pas une machine.",
      "Une connexion est définie par quatre valeurs : l'adresse IP et le port du client, l'adresse IP et le port du serveur. C'est pourquoi un serveur peut recevoir plusieurs connexions sur le même port, tant que les clients sont différents. Un port peut donc servir à plusieurs connexions à la fois.",
      "Le client reçoit en général un port éphémère, choisi par son système. Il n'est pas le même que celui du serveur.",
      "Les ports existent aussi bien en TCP qu'en UDP.",
    ],
  },
  {
    subject: "le contrôle de flux",
    points: [
      "Le destinataire annonce une fenêtre : le nombre d'octets qu'il peut encore recevoir. L'expéditeur ne doit pas envoyer plus que cela sans accusé. La fenêtre est donc fixée par le destinataire, pas par l'expéditeur.",
      "Un destinataire débordé annonce une fenêtre plus petite. Si elle tombe à zéro, l'expéditeur fait seulement une pause : la connexion n'est pas fermée.",
      "La fenêtre se mesure en octets, pas en nombre de paquets. Elle protège le destinataire.",
      "Il ne faut pas la confondre avec le contrôle de congestion, qui protège les routeurs du réseau.",
    ],
  },
  {
    subject: "l'ouverture d'une connexion TCP",
    points: ["Les événements de l'ouverture, dans l'ordre chronologique :"],
    steps: ["SYN du client", "SYN-ACK du serveur", "ACK du client", "Premières données"],
  },
  {
    subject: "la fermeture d'une connexion TCP",
    points: ["Les événements de la fermeture, dans l'ordre chronologique :"],
    steps: ["FIN du client", "ACK du serveur", "FIN du serveur", "ACK du client"],
  },
  {
    subject: "la perte d'un segment de données",
    points: ["Ce qui se passe quand un segment se perd, dans l'ordre chronologique :"],
    steps: [
      "Le client envoie les données",
      "Les données se perdent",
      "Le délai de retransmission expire",
      "Le client renvoie les données",
      "Le serveur envoie son ACK",
    ],
  },
];
