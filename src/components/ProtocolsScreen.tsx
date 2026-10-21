import { useState } from "react";
import {
  distinct,
  filterItems,
  NO_FILTER,
  type Browsable,
  type Criteria,
} from "../exercises/filter";
import { PROTOCOLS, findProtocol } from "../protocols/catalog";
import type { ValidatedProtocols } from "../protocols/useValidatedProtocols";
import { CatalogFilters, PROTOCOL_COPY } from "./CatalogFilters";
import { ProtocolList } from "./ProtocolList";
import { ProtocolPage } from "./ProtocolPage";
import { DepthTransition } from "./DepthTransition";
import { navigate } from "../transitions";
import { rewardOf, type Reward } from "../xp";

/** What the filter panel searches in: the name and the full name, the tagline, the themes. */
const BROWSABLE: readonly Browsable[] = PROTOCOLS.map((protocol) => ({
  id: protocol.id,
  title: `${protocol.name} ${protocol.fullName}`,
  summary: protocol.tagline,
  topics: protocol.topics,
  difficulty: protocol.difficulty,
}));

const TOPICS = distinct(PROTOCOLS.flatMap((protocol) => protocol.topics));

interface ProtocolsScreenProps {
  /** The open protocol, kept by the shell so that the breadcrumb can show and leave it. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Kept by the shell: the sidebar shows the count too. */
  validated: ValidatedProtocols;
  /** Called when a protocol is validated for the first time, before the list is read again. */
  onReward: (reward: Reward) => void;
}

/** The protocols, as cards with a filter panel like the exercises, and one page per protocol. */
export function ProtocolsScreen({
  selectedId,
  onSelect,
  validated,
  onReward,
}: ProtocolsScreenProps) {
  // Kept here, so the filters survive opening a protocol and coming back.
  const [criteria, setCriteria] = useState<Criteria>(NO_FILTER);

  const selected = selectedId === null ? undefined : findProtocol(selectedId);
  if (selected) {
    return (
      <DepthTransition key={selected.id}>
        <section className="screen protocols-page">
          {/* Keyed by protocol: opening another one restarts its diagram and its quiz. */}
          <ProtocolPage
            key={selected.id}
            protocol={selected}
            validated={validated.ids.has(selected.id)}
            validatedIds={validated.ids}
            onValidated={() => {
              if (!validated.ids.has(selected.id)) onReward(rewardOf(selected.difficulty));
              void validated.refresh();
            }}
            onOpen={(id) => {
              navigate(() => {
                onSelect(id);
              }, "nav-forward");
            }}
            onBack={() => {
              navigate(() => {
                onSelect(null);
              }, "nav-back");
            }}
          />
        </section>
      </DepthTransition>
    );
  }

  const visibleIds = new Set(
    filterItems(BROWSABLE, validated.ids, criteria).map((item) => item.id),
  );
  const visible = PROTOCOLS.filter((protocol) => visibleIds.has(protocol.id));
  const validatedCount = PROTOCOLS.filter((protocol) => validated.ids.has(protocol.id)).length;

  return (
    <DepthTransition key="list">
      <section className="screen exercises-page">
        <h2>Protocoles</h2>
        <p className="protocols-progress">
          <span className="tabular-nums">
            {validatedCount} / {PROTOCOLS.length}
          </span>{" "}
          protocoles validés. Chacun se termine par un quiz : il faut le réussir en entier pour le
          valider.
        </p>
        {validated.error !== null && <p className="alert alert-danger">{validated.error}</p>}
        <div className="exercises-layout">
          <CatalogFilters
            criteria={criteria}
            onChange={setCriteria}
            languages={[]}
            topics={TOPICS}
            resultCount={visible.length}
            copy={PROTOCOL_COPY}
          />
          <ProtocolList
            protocols={visible}
            validated={validated.ids}
            onOpen={(id) => {
              navigate(() => {
                onSelect(id);
              }, "nav-forward");
            }}
            onReset={() => {
              setCriteria(NO_FILTER);
            }}
          />
        </div>
      </section>
    </DepthTransition>
  );
}
