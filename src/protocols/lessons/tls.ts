import type { Lesson } from "../types";

/** One lesson per subject of the quiz (`src-tauri/protocols/tls.json`): what a question asks is taught here. */
export const tlsLessons: readonly Lesson[] = [
  {
    subject: "ce que TLS garantit",
    points: [
      "TLS apporte trois garanties : la confidentialité (personne d'autre ne peut lire les données), l'intégrité (une modification en route est détectée) et l'authenticité (on sait à qui l'on parle, grâce au certificat). Il garantit les trois, pas seulement l'absence de modification.",
      "TLS n'accélère rien : il ajoute une poignée de main à l'ouverture.",
      "TLS ne cache pas l'adresse IP du serveur : un observateur voit toujours à quelle machine on parle.",
      "Un site qui utilise TLS n'est pas forcément honnête. TLS prouve seulement qu'on parle bien au titulaire du certificat : un site malveillant peut très bien l'utiliser.",
    ],
  },
  {
    subject: "SSL et TLS",
    points: [
      "SSL est l'ancien nom de TLS : TLS en est le successeur, ils sont donc liés. TLS est la version la plus récente, pas SSL.",
      "SSL 3.0 est abandonné parce qu'il est cassé : on ne le recommande plus. TLS 1.0 est lui aussi ancien et abandonné.",
      "On utilise aujourd'hui TLS 1.2, et surtout TLS 1.3, la version la plus moderne.",
      "Un certificat dit « SSL » est en réalité un certificat utilisé avec TLS : l'expression est un abus de langage resté dans l'usage.",
    ],
  },
  {
    subject: "le secret partagé",
    points: [
      "Le client et le serveur doivent obtenir le même secret en parlant en public. Chacun garde une clé privée et envoie une clé publique éphémère.",
      "Chaque côté combine sa clé privée avec la clé publique de l'autre et obtient le même secret. C'est un échange de Diffie-Hellman.",
      "Le secret n'est jamais envoyé sur le réseau : ni en clair, ni dans le certificat. Les clés privées ne sont pas non plus échangées.",
      "Un espion qui a vu passer les clés publiques ne peut pas retrouver le secret : il lui manque une clé privée.",
    ],
  },
  {
    subject: "le certificat",
    points: [
      "Un certificat lie un nom de domaine à une clé publique. Il ne contient jamais la clé privée du serveur.",
      "Il est signé par une autorité de certification, pas par le client.",
      "Il a une date de validité : il n'est pas valable pour toujours.",
      "Le client vérifie que le nom du certificat correspond au site visité. Le certificat ne sert pas à compresser les données.",
    ],
  },
  {
    subject: "la vérification du certificat",
    points: [
      "C'est le client qui vérifie le certificat, pas le serveur à sa place. Il contrôle la signature de l'autorité, la date de validité et le nom.",
      "Le client connaît d'avance la liste des autorités auxquelles il fait confiance.",
      "Un doute sur le certificat doit faire refuser la connexion : il ne faut jamais accepter n'importe quel certificat, et jamais ignorer sa date.",
      "Le client ne demande à personne la clé privée du serveur. Le serveur prouve qu'il la possède en faisant une signature, sans jamais la révéler.",
    ],
  },
  {
    subject: "le ClientHello",
    points: [
      "Le ClientHello est le premier message de la poignée de main, envoyé par le client (le serveur répond par un ServerHello). Il est envoyé au tout début, bien avant les données de l'application.",
      "Il liste les algorithmes que le client sait utiliser, et indique le nom du site visé (SNI).",
      "En TLS 1.3, il contient déjà la clé publique éphémère du client.",
      "Il ne contient ni le certificat du client ni le secret partagé, qui n'est jamais envoyé.",
    ],
  },
  {
    subject: "la poignée de main TLS 1.3",
    points: [
      "En TLS 1.3, il suffit d'un seul aller-retour avant d'envoyer des données chiffrées. TLS 1.2 en demandait deux : TLS 1.3 n'en demande pas plus, ni trois.",
      "Dès le ServerHello, la suite des échanges est chiffrée. Le certificat circule donc déjà chiffré, et non en clair.",
      "La poignée de main commence par le ClientHello, pas par le certificat.",
      "Le serveur prouve qu'il possède la clé privée de son certificat. Elle se termine par des messages Finished, un de chaque côté.",
    ],
  },
  {
    subject: "ce que voit un espion",
    points: [
      "Un espion sur le réseau voit l'adresse du serveur contacté, la taille et le moment des échanges.",
      "Il ne voit pas le contenu échangé, donc ni les mots de passe ni les données : il ne lit que des octets illisibles.",
      "Il ne peut pas modifier un échange sans que cela soit détecté, grâce à l'intégrité.",
    ],
  },
  {
    subject: "la poignée de main TLS 1.3",
    points: ["Les messages de la poignée de main, dans l'ordre :"],
    steps: [
      "ClientHello",
      "ServerHello",
      "Certificat du serveur",
      "Finished du serveur",
      "Finished du client",
      "Données chiffrées",
    ],
  },
];
