import type { Lesson } from "../types";

/** One lesson per subject of the quiz (`src-tauri/protocols/ssh.json`): what a question asks is taught here. */
export const sshLessons: readonly Lesson[] = [
  {
    subject: "le rôle de SSH",
    points: [
      "SSH ouvre un canal chiffré vers une machine distante, pour y commander des programmes en sécurité. Il ne sert pas à afficher des pages web.",
      "Il a remplacé Telnet, qui envoyait les mots de passe en clair : Telnet est donc moins sûr, pas plus sûr.",
      "Le même canal permet aussi de copier des fichiers (scp, sftp) : SSH peut transférer des fichiers.",
      "Le port habituel de SSH est le 22. Le 443 est celui d'HTTPS.",
    ],
  },
  {
    subject: "la clé d'hôte",
    points: [
      "La clé d'hôte prouve l'identité du serveur, pas celle de l'utilisateur.",
      "Le client la mémorise dans le fichier known_hosts après la première connexion. Si elle change, SSH prévient : il n'accepte pas le changement en silence.",
      "Une alerte de changement de clé peut signaler une attaque de l'homme du milieu : quelqu'un se fait peut-être passer pour le serveur.",
      "Contrairement à TLS, SSH n'a pas d'autorité de certification : la clé d'hôte n'est vérifiée par aucune autorité, c'est le client qui s'en souvient.",
      "La partie publique de la clé d'hôte est montrée à tous les clients, elle n'est pas secrète. Seule sa partie privée reste secrète, sur le serveur.",
    ],
  },
  {
    subject: "la première connexion à un serveur",
    points: [
      "À la première connexion, SSH ne peut rien vérifier tout seul, faute d'autorité de certification. Il demande donc de confirmer l'empreinte de la clé du serveur : elle n'est jamais vérifiée automatiquement et la demande est toujours posée.",
      "Il faut comparer cette empreinte avec une source fiable : elle n'est pas inutile à vérifier.",
      "Une fois acceptée, le serveur est retenu dans known_hosts. Accepter l'empreinte n'envoie pas ton mot de passe : cela ne fait que mémoriser la clé.",
      "Accepter sans vérifier laisse la porte ouverte à un imposteur.",
    ],
  },
  {
    subject: "la paire de clés",
    points: [
      "La clé privée reste sur la machine de l'utilisateur. Elle n'est jamais copiée sur le serveur et ne voyage jamais sur le réseau : elle n'est pas envoyée à chaque connexion.",
      "La clé publique est placée sur le serveur, dans le fichier authorized_keys. Elle n'est pas secrète : on peut la montrer sans risque.",
      "Une signature prouve qu'on possède la clé privée. La clé publique ne peut pas signer à la place de l'utilisateur : elle sert à vérifier la signature.",
    ],
  },
  {
    subject: "l'authentification par clé",
    points: [
      "Le client présente d'abord sa clé publique. Le serveur regarde si elle figure dans authorized_keys : la vérification se fait bien du côté du serveur.",
      "Le client prouve ensuite qu'il possède la clé privée en signant des données de la session. Il n'envoie jamais sa clé privée au serveur, et le serveur n'envoie pas non plus la sienne au client.",
      "Ces données contiennent l'identifiant unique de la session : la signature ne peut donc pas être rejouée dans une autre session.",
    ],
  },
  {
    subject: "l'échange de clés",
    points: [
      "Comme dans TLS, les deux côtés calculent le même secret sans jamais l'envoyer, ni en clair ni autrement.",
      "Le serveur signe sa partie de l'échange avec sa clé d'hôte, pour prouver son identité : il a bien une clé à prouver.",
      "Après le message NEWKEYS, tout est chiffré.",
      "L'authentification de l'utilisateur a lieu une fois le canal chiffré, jamais avant : le mot de passe n'est donc pas envoyé avant le chiffrement. L'échange de clés précède la connexion de l'utilisateur, il ne la suit pas.",
    ],
  },
  {
    subject: "la négociation des algorithmes",
    points: [
      "Au début de la connexion, le client propose la liste des algorithmes qu'il sait utiliser et le serveur choisit ceux qu'ils ont en commun. Le serveur ne les impose pas, et SSH n'en utilise pas un seul fixe.",
      "Rien n'est fixé pour toujours dans le protocole : comme tout est négocié, on peut retirer un algorithme ancien du serveur pour renforcer la sécurité.",
      "ed25519 est un type de clé SSH, pas un mot de passe.",
    ],
  },
  {
    subject: "les mots de passe SSH",
    points: [
      "Un mot de passe SSH passe dans le canal chiffré : il ne circule pas en clair.",
      "Un mot de passe faible peut être deviné par des essais répétés. Une clé est donc en général préférable, un mot de passe n'est pas toujours plus sûr.",
      "Un serveur peut désactiver l'authentification par mot de passe : il n'est pas obligé de l'accepter.",
    ],
  },
  {
    subject: "l'ouverture d'une session SSH",
    points: ["Les étapes d'une ouverture de session, dans l'ordre :"],
    steps: [
      "Les deux côtés annoncent leur version",
      "Le client propose ses algorithmes",
      "Le serveur envoie sa clé d'hôte",
      "Le client vérifie la clé d'hôte",
      "Le canal passe en chiffré (NEWKEYS)",
      "Le client s'authentifie",
      "La session s'ouvre",
    ],
  },
  {
    subject: "l'authentification par clé",
    points: ["Les étapes d'une authentification par clé, dans l'ordre :"],
    steps: [
      "Le client offre sa clé publique",
      "Le serveur reconnaît la clé",
      "Le client signe des données de la session",
      "Le serveur vérifie la signature",
      "L'accès est accordé",
    ],
  },
];
