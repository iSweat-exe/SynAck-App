import { dns } from "./data/dns";
import { http } from "./data/http";
import { https } from "./data/https";
import { ipc } from "./data/ipc";
import { ssh } from "./data/ssh";
import { tcp } from "./data/tcp";
import { tls } from "./data/tls";
import { udp } from "./data/udp";
import type { Protocol } from "./types";

/** In the order they are best read: the layers underneath first. */
export const PROTOCOLS: readonly Protocol[] = [tcp, udp, dns, http, tls, https, ssh, ipc];

export const FIRST_PROTOCOL = tcp;

export function findProtocol(id: string): Protocol | undefined {
  return PROTOCOLS.find((protocol) => protocol.id === id);
}
