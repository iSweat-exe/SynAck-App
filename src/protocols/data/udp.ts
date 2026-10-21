import { udpLessons } from "../lessons/udp";
import type { Protocol } from "../types";

export const udp: Protocol = {
  id: "udp",
  name: "UDP",
  fullName: "User Datagram Protocol",
  tagline: "On envoie, point. Rapide, léger, et sans aucune garantie.",
  difficulty: "easy",
  topics: ["Réseau"],
  prerequisites: ["tcp"],
  notions: [],
  purpose: [
    "UDP est l'opposé de TCP : pas de connexion, pas d'accusé, pas de renvoi, pas d'ordre. Chaque message (un datagramme) part seul, et peut se perdre sans que personne ne le sache.",
    "Ce qui ressemble à un défaut est un choix. Pour un appel vidéo, un jeu en ligne ou une requête DNS, une réponse en retard ne sert à rien : mieux vaut en envoyer une nouvelle que d'attendre l'ancienne. Quand il faut de la fiabilité, c'est l'application qui la construit elle-même.",
  ],
  takeaways: [
    "Pas de poignée de main : le premier paquet est déjà une donnée.",
    "Aucun accusé de réception : l'expéditeur ne sait pas si le message est arrivé.",
    "Les datagrammes peuvent arriver dans le désordre, en double, ou jamais.",
    "Le DNS, la voix sur IP, les jeux et QUIC (HTTP/3) utilisent UDP.",
  ],
  facts: [
    { label: "Couche", value: "Transport (4)" },
    { label: "Fiabilité", value: "Aucune" },
    { label: "Ordre", value: "Non garanti" },
    { label: "Connexion", value: "Non" },
  ],
  lessons: udpLessons,
  actors: [
    { id: "client", name: "Client", role: "envoie" },
    { id: "server", name: "Serveur", role: "écoute sur un port" },
  ],
  steps: [
    {
      from: "client",
      to: "client",
      label: "Aucune connexion",
      note: "Le client n'ouvre rien et ne demande la permission à personne. Il met ses données dans un datagramme et l'envoie.",
    },
    {
      from: "client",
      to: "server",
      label: "Datagramme 1",
      note: "Le datagramme part avec seulement quatre informations : port d'origine, port de destination, longueur et somme de contrôle.",
      detail: "UDP  53124 → 9000  len=32",
    },
    {
      from: "client",
      to: "server",
      label: "Datagramme 2",
      note: "Un deuxième datagramme part tout de suite après, sans attendre de nouvelle du premier.",
      detail: "UDP  53124 → 9000  len=32",
      loss: {
        lost: "Le datagramme disparaît en chemin. Aucun routeur ne préviendra personne.",
        wait: "Le client n'attend rien et le serveur ne sait pas qu'il manque quelque chose. Il n'y a ni délai ni accusé.",
        retry:
          "Si l'application tient à ce message, c'est à elle de le renvoyer. Ici, elle le fait elle-même.",
      },
    },
    {
      from: "server",
      to: "client",
      label: "Réponse",
      note: "Le serveur répond de la même façon : un datagramme, sans garantie. Le client ne sait pas non plus si elle arrivera.",
      detail: "UDP  9000 → 53124  len=12",
      tone: "success",
    },
  ],
  related: ["tcp", "dns"],
};
