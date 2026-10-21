import type { Lesson } from "../types";

/** One lesson per subject of the quiz (`src-tauri/protocols/ipc.json`): what a question asks is taught here. */
export const ipcLessons: readonly Lesson[] = [
  {
    subject: "ce qu'est l'IPC",
    points: [
      "L'IPC (communication inter-processus) fait communiquer des programmes en cours d'exécution, les processus, sur une même machine. Ce n'est pas une communication entre deux ordinateurs, et elle n'a pas besoin d'Internet.",
      "Chaque processus a sa propre mémoire, isolée des autres par le système : deux processus ne partagent pas la même mémoire par défaut.",
      "Un processus ne peut pas lire directement les variables d'un autre.",
      "Pour échanger, il faut passer par le système d'exploitation, qui offre plusieurs mécanismes.",
    ],
  },
  {
    subject: "le rôle du noyau",
    points: [
      "Le noyau est le cœur du système d'exploitation. Dans l'IPC, il joue le rôle du facteur : il intervient toujours, il transporte le message d'un processus à l'autre.",
      "Un processus ne peut pas écrire dans la mémoire d'un autre : il demande au noyau d'écrire dans le tube qui les relie.",
      "Le noyau garde les octets dans un tampon, le temps que le destinataire vienne les lire. Il ne les jette pas et n'efface pas la mémoire des processus.",
      "Le noyau protège la mémoire de chaque processus.",
    ],
  },
  {
    subject: "les tubes",
    points: [
      "Un tube (pipe) transporte des octets dans un seul sens : ce qu'un processus écrit à un bout est lu à l'autre bout. Il ne va pas dans les deux sens à la fois.",
      "Dans un shell, le symbole | relie la sortie d'une commande à l'entrée de la suivante grâce à un tube. Il n'efface rien.",
      "Un processus qui lit un tube vide se met en attente : il ne plante pas.",
      "Un tube relie deux processus de la même machine, pas deux ordinateurs distants.",
    ],
  },
  {
    subject: "les sockets locales",
    points: [
      "Une socket locale permet de communiquer dans les deux sens, contrairement à un tube.",
      "Sous Unix, elle passe par un fichier spécial. Sous Windows, les tubes nommés jouent un rôle proche : les sockets locales n'existent donc pas que sous Windows.",
      "Elle reste sur la machine : elle ne passe pas par le réseau, n'envoie rien sur Internet et ne demande l'accord d'aucun serveur distant.",
    ],
  },
  {
    subject: "la mémoire partagée",
    points: [
      "Deux processus peuvent se partager une zone de mémoire : c'est le noyau qui la met à leur disposition. Cela n'a pas lieu automatiquement entre tous les processus.",
      "Comme elle évite de copier les données, c'est le moyen le plus rapide d'échanger beaucoup de données : elle n'est pas plus lente qu'un tube.",
      "Les processus doivent se coordonner pour ne pas écrire en même temps : la coordination est nécessaire.",
      "Seule cette zone est commune : elle ne donne pas accès à toute la mémoire de l'autre processus.",
    ],
  },
  {
    subject: "la sérialisation d'un message",
    points: [
      "Seuls des octets traversent la frontière entre processus. Un objet en mémoire ne peut pas être transmis tel quel : il faut le transformer en octets, c'est la sérialisation. Elle est nécessaire même en local, pas seulement entre ordinateurs distants.",
      "JSON est un format courant pour sérialiser un message.",
      "Le destinataire doit décoder le message reçu.",
      "Les deux processus doivent s'accorder sur le format : chacun ne peut pas choisir librement le sien.",
    ],
  },
  {
    subject: "les signaux",
    points: [
      "Un signal est une notification très simple envoyée à un processus. Il ne transporte pas de données complexes : il ne peut pas porter un fichier entier, ni un message JSON.",
      "Ctrl+C dans un terminal envoie un signal au programme. Ce n'est pas un message JSON.",
      "Un signal peut arrêter un processus : c'est par exemple ce que fait Ctrl+C.",
      "Un processus peut décider comment réagir à certains signaux : il peut donc réagir à un signal, par exemple pour se terminer proprement.",
    ],
  },
  {
    subject: "l'exemple de SynAck",
    points: [
      "Dans SynAck, l'interface (dans la WebView) et le moteur Rust sont deux contextes séparés : l'interface ne lit pas directement la mémoire du moteur.",
      "Ils échangent des messages : l'interface appelle une commande du moteur en lui envoyant un message, et la réponse revient par le même chemin (pas par courrier électronique).",
      "C'est le moteur, et non l'interface, qui juge si un exercice est résolu et qui l'enregistre. L'interface se contente d'afficher le résultat.",
    ],
  },
  {
    subject: "un échange par tube entre deux processus",
    points: ["Les étapes d'un échange, dans l'ordre :"],
    steps: [
      "A prépare et sérialise le message",
      "A demande au noyau d'écrire dans le tube",
      "Le noyau copie le message dans un tampon",
      "Le noyau remet le message à B",
      "B traite la demande",
      "B renvoie sa réponse par le noyau",
    ],
  },
  {
    subject: "la lecture d'un tube vide",
    points: ["Ce qui se passe quand B lit un tube vide, dans l'ordre :"],
    steps: [
      "B lit le tube",
      "Le tube est vide : B se met en attente",
      "A écrit dans le tube",
      "Le noyau réveille B",
      "B reçoit le message",
    ],
  },
];
