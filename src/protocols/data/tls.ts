import { tlsLessons } from "../lessons/tls";
import type { Protocol } from "../types";

export const tls: Protocol = {
  id: "tls",
  name: "TLS / SSL",
  fullName: "Transport Layer Security",
  tagline: "Chiffre la conversation et prouve à qui tu parles.",
  difficulty: "hard",
  topics: ["Sécurité"],
  prerequisites: ["tcp"],
  notions: ["Avoir déjà entendu parler de clé publique et de clé privée"],
  purpose: [
    "TLS s'ajoute à une connexion TCP et lui donne trois garanties : la confidentialité (personne ne peut lire), l'intégrité (personne ne peut modifier sans que ça se voie) et l'authenticité (tu parles bien au vrai serveur, grâce à son certificat).",
    "SSL est l'ancien nom. SSL 2.0 et 3.0 sont cassés depuis longtemps, TLS 1.0 et 1.1 sont abandonnés : on utilise TLS 1.2 et surtout TLS 1.3, présenté ici. Quand on parle encore de « certificat SSL », c'est un abus de langage pour un certificat TLS.",
    "Le tour de force est de se mettre d'accord sur un secret en parlant en public : chacun envoie une moitié (une clé publique éphémère) et, par un calcul de Diffie-Hellman, les deux obtiennent le même secret sans qu'il ait jamais circulé.",
  ],
  takeaways: [
    "Le secret partagé n'est jamais envoyé : chacun le calcule de son côté.",
    "Le certificat, signé par une autorité de confiance, lie un nom de domaine à une clé.",
    "Le client doit vérifier le certificat : sinon, n'importe qui peut se faire passer pour le serveur.",
    "TLS 1.3 chiffre la suite de la poignée de main dès le ServerHello, et la boucle en un aller-retour.",
  ],
  facts: [
    { label: "Couche", value: "Entre TCP et l'application" },
    { label: "Versions utilisables", value: "TLS 1.2 et 1.3" },
    { label: "Obsolètes", value: "SSL 2/3, TLS 1.0/1.1" },
    { label: "Coût", value: "1 aller-retour (TLS 1.3)" },
  ],
  lessons: tlsLessons,
  actors: [
    { id: "client", name: "Client", role: "navigateur, appli" },
    { id: "server", name: "Serveur", role: "possède un certificat" },
  ],
  steps: [
    {
      from: "client",
      to: "server",
      label: "ClientHello",
      note: "Le client propose ses algorithmes de chiffrement et envoie déjà sa moitié du calcul (une clé publique éphémère). Il indique aussi le nom du site visé (SNI).",
      detail:
        "versions: TLS 1.3, 1.2\nchiffrements: AES-256-GCM, ChaCha20\nkey_share: clé publique éphémère (X25519)\nserver_name: example.com",
      tone: "brand",
    },
    {
      from: "server",
      to: "client",
      label: "ServerHello",
      note: "Le serveur choisit un chiffrement et envoie sa moitié du calcul. À partir de là, tout le reste est chiffré.",
      detail: "chiffrement: TLS_AES_256_GCM_SHA384\nkey_share: clé publique éphémère du serveur",
      tone: "brand",
    },
    {
      from: "client",
      to: "client",
      label: "Calcule le secret",
      note: "Avec sa clé privée et la clé publique du serveur, le client obtient un secret. Le serveur, de son côté, arrive au même par le chemin inverse. Un espion, qui n'a vu que les clés publiques, ne peut pas le retrouver.",
      states: { client: "Chiffré", server: "Chiffré" },
    },
    {
      from: "server",
      to: "client",
      label: "Certificat",
      note: "Le serveur prouve son identité : son certificat, signé par une autorité, et une signature faite avec sa clé privée.",
      detail:
        "sujet: example.com\némis par: une autorité de certification\nvalide: du 2026-01-10 au 2026-04-10\nsignature de la poignée de main",
    },
    {
      from: "client",
      to: "client",
      label: "Vérifie le certificat",
      note: "Le client contrôle la signature de l'autorité (qu'il connaît d'avance), la date de validité, et que le nom du certificat correspond au site visé. S'il y a un doute, la connexion est refusée.",
      tone: "warning",
    },
    {
      from: "server",
      to: "client",
      label: "Finished",
      note: "Le serveur prouve qu'il a bien calculé le même secret, en signant tout l'échange.",
      tone: "success",
    },
    {
      from: "client",
      to: "server",
      label: "Finished",
      note: "Le client fait de même. La poignée de main est terminée après un seul aller-retour.",
      tone: "success",
      states: { client: "Sécurisé", server: "Sécurisé" },
    },
    {
      from: "client",
      to: "server",
      label: "Données chiffrées",
      note: "Les données de l'application passent maintenant chiffrées et authentifiées. Un espion ne voit que des octets sans sens, et toute modification est détectée.",
      detail: "17 03 03 00 5a 8f 2e c1 94 0b …",
      tone: "success",
    },
  ],
  related: ["https", "tcp", "ssh"],
};
