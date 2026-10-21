import { httpLessons } from "../lessons/http";
import type { Protocol } from "../types";

export const http: Protocol = {
  id: "http",
  name: "HTTP",
  fullName: "HyperText Transfer Protocol",
  tagline: "Le langage du web : une requête, une réponse.",
  difficulty: "easy",
  topics: ["Web"],
  prerequisites: ["tcp"],
  notions: ["Connaître la différence entre un client et un serveur"],
  purpose: [
    "HTTP est un protocole de questions et de réponses, en texte lisible. Le client demande une ressource avec une méthode (GET pour lire, POST pour envoyer, DELETE pour supprimer), une adresse, et des en-têtes. Le serveur répond avec un code de statut, des en-têtes, puis le contenu.",
    "HTTP ne retient rien d'une requête à l'autre : chacune est indépendante. Les cookies et les jetons sont ajoutés par-dessus pour savoir qui tu es. Et en HTTP simple, tout circule en clair : n'importe qui sur le chemin peut lire et modifier. C'est le rôle de HTTPS d'y remédier.",
  ],
  takeaways: [
    "Le client commence toujours : le serveur ne fait que répondre.",
    "Le code de statut résume le résultat : 2xx réussi, 3xx redirection, 4xx erreur du client, 5xx erreur du serveur.",
    "Chaque requête est indépendante : le serveur n'a pas de mémoire sans cookie ni jeton.",
    "En clair, HTTP est lisible par tout intermédiaire : on utilise HTTPS.",
  ],
  facts: [
    { label: "Couche", value: "Application (7)" },
    { label: "Port", value: "80 (443 pour HTTPS)" },
    { label: "Transport", value: "TCP (QUIC pour HTTP/3)" },
    { label: "Format", value: "Texte (HTTP/1.1), binaire (HTTP/2, 3)" },
  ],
  lessons: httpLessons,
  actors: [
    { id: "browser", name: "Navigateur", role: "le client" },
    { id: "server", name: "Serveur", role: "port 80" },
  ],
  steps: [
    {
      from: "browser",
      to: "server",
      label: "GET /index.html",
      note: "Une connexion TCP est déjà ouverte. Le navigateur demande la page, et s'annonce avec l'en-tête Host, obligatoire.",
      detail: "GET /index.html HTTP/1.1\nHost: example.com\nAccept: text/html",
      tone: "brand",
    },
    {
      from: "server",
      to: "server",
      label: "Cherche la page",
      note: "Le serveur trouve la ressource demandée : un fichier, ou le résultat d'un programme.",
    },
    {
      from: "server",
      to: "browser",
      label: "200 OK",
      note: "Succès. La réponse indique le type du contenu et sa taille, puis vient le contenu lui-même.",
      detail: "HTTP/1.1 200 OK\nContent-Type: text/html\nContent-Length: 1256\n\n<!doctype html> …",
      tone: "success",
    },
    {
      from: "browser",
      to: "browser",
      label: "Lit la page",
      note: "Le navigateur lit le HTML, y trouve une image, et la demande à son tour : une nouvelle requête, indépendante de la première.",
    },
    {
      from: "browser",
      to: "server",
      label: "GET /logo.png",
      note: "Deuxième requête, sur la même connexion.",
      detail: "GET /logo.png HTTP/1.1\nHost: example.com",
      tone: "brand",
    },
    {
      from: "server",
      to: "browser",
      label: "404 Not Found",
      note: "Cette image n'existe pas. Le code 404 dit « pas trouvé » : c'est une erreur du côté du client (4xx), le serveur, lui, fonctionne.",
      detail: "HTTP/1.1 404 Not Found\nContent-Length: 0",
      tone: "danger",
    },
  ],
  related: ["https", "tcp", "dns"],
};
