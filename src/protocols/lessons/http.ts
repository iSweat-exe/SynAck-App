import type { Lesson } from "../types";

/** One lesson per subject of the quiz (`src-tauri/protocols/http.json`): what a question asks is taught here. */
export const httpLessons: readonly Lesson[] = [
  {
    subject: "une requête HTTP",
    points: [
      "En HTTP/1.1, une requête est du texte lisible : une première ligne (la méthode, l'adresse demandée, la version), puis des en-têtes.",
      "Une requête a des en-têtes. L'un d'eux est obligatoire : Host, qui indique le nom du site visé. Il n'indique pas le navigateur utilisé.",
      "La méthode GET sert à lire une ressource. Elle ne supprime rien.",
      "HTTP simple n'est pas chiffré : une requête HTTP circule en clair, elle n'est pas toujours chiffrée.",
    ],
  },
  {
    subject: "les méthodes HTTP",
    points: [
      "GET lit une ressource sans la modifier. POST envoie des données au serveur, dans le corps de la requête, par exemple un formulaire. PUT remplace une ressource. DELETE demande sa suppression.",
      "DELETE ne sert pas à lire et PUT ne supprime pas : chaque méthode a son rôle.",
      "Avec GET, les paramètres sont dans l'adresse, donc visibles dans l'historique et dans les journaux. Ce n'est pas une façon sécurisée d'envoyer un mot de passe : un formulaire de connexion utilise POST, et HTTPS.",
    ],
  },
  {
    subject: "les codes de statut",
    points: [
      "Le code de statut résume le résultat. 2xx : succès. 3xx : redirection, il faut aller voir une autre adresse (ce n'est pas un « tout va bien, rien d'autre à faire »). 4xx : erreur du client. 5xx : erreur du serveur.",
      "404 veut dire que la ressource n'a pas été trouvée : c'est une erreur du client (4xx), le serveur, lui, fonctionne.",
      "Un code 5xx signale une erreur du côté du serveur, pas du côté du client. Un code 2xx n'est jamais une erreur.",
    ],
  },
  {
    subject: "une réponse HTTP",
    points: [
      "Une réponse HTTP commence par la ligne de statut (avec le code), puis les en-têtes, puis une ligne vide, puis le contenu. Le contenu vient donc à la fin, après les en-têtes.",
      "L'en-tête Content-Type indique le type du contenu renvoyé (par exemple text/html).",
      "L'en-tête Content-Length indique sa taille en octets.",
    ],
  },
  {
    subject: "l'absence de mémoire de HTTP",
    points: [
      "HTTP n'a aucune mémoire d'une requête à l'autre : chaque requête est indépendante. Le serveur ne garde pas automatiquement la liste de tes requêtes, et HTTP n'a pas de mécanisme de connexion avec mot de passe intégré.",
      "Pour te reconnaître, on ajoute un cookie (ou un jeton) : le serveur le donne, et le navigateur le renvoie à chaque requête vers le même site.",
      "Les cookies servent à garder une session ouverte. Sans cookie ni jeton, HTTP ne retient pas qui tu es entre deux requêtes.",
    ],
  },
  {
    subject: "le client et le serveur",
    points: [
      "Le client commence toujours l'échange en envoyant une requête, et le serveur répond. Le serveur ne commence pas : c'est lui qui répond à la demande du client, et le client ne répond pas aux requêtes du serveur.",
      "Un serveur HTTP écoute par défaut sur le port 80 (le port 22 est celui de SSH).",
      "Grâce à l'en-tête Host, un même serveur peut héberger plusieurs sites.",
    ],
  },
  {
    subject: "HTTP en clair",
    points: [
      "HTTP simple circule en clair : il ne chiffre rien par défaut. N'importe quel intermédiaire (un Wi-Fi public, un routeur) peut lire une requête, mais aussi modifier une réponse. Le destinataire n'est pas le seul à pouvoir lire.",
      "HTTPS (HTTP transporté dans TLS) corrige ces faiblesses : il ne rend pas la lecture plus facile pour un intermédiaire, il la rend impossible.",
    ],
  },
  {
    subject: "les versions de HTTP",
    points: [
      "Il existe plusieurs versions de HTTP.",
      "HTTP/1.1 est en texte lisible et s'appuie sur TCP.",
      "HTTP/2 est un protocole binaire (donc pas lisible comme du texte), lui aussi sur TCP.",
      "HTTP/3 s'appuie sur QUIC, lui-même construit sur UDP, et non sur TCP.",
    ],
  },
  {
    subject: "une requête HTTP, de l'envoi à l'affichage",
    points: ["Les événements d'un chargement de page, dans l'ordre chronologique :"],
    steps: [
      "Le navigateur envoie la requête GET",
      "Le serveur cherche la ressource",
      "Le serveur envoie la réponse 200",
      "Le navigateur affiche la page",
    ],
  },
  {
    subject: "les parties d'une réponse HTTP",
    points: ["Les parties d'une réponse, dans l'ordre où elles arrivent :"],
    steps: ["La ligne de statut", "Les en-têtes", "Une ligne vide", "Le contenu"],
  },
];
