import { useState } from "react";
import type { AuthUser } from "../api/auth";

export const PROVIDER_LABEL: Record<string, string> = { github: "GitHub", discord: "Discord" };

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

/** The photo of the account, or its initials when there is none or it cannot be loaded. */
export function Avatar({ user, size = 40 }: { user: AuthUser; size?: number }) {
  const [broken, setBroken] = useState(false);

  return user.avatarUrl && !broken ? (
    <img
      className="avatar"
      src={user.avatarUrl}
      alt=""
      width={size}
      height={size}
      // The provider's image host does not need to know where the picture is shown.
      referrerPolicy="no-referrer"
      onError={() => {
        setBroken(true);
      }}
    />
  ) : (
    <span className="avatar avatar-initials" aria-hidden="true">
      {initials(user.name)}
    </span>
  );
}

interface AccountCardProps {
  user: AuthUser;
  /** True while the profile page is the current page. */
  profileOpen: boolean;
  onOpenProfile: () => void;
}

/** Who is signed in: a link to the profile, where the way out is. Lives at the bottom of the sidebar. */
export function AccountCard({ user, profileOpen, onOpenProfile }: AccountCardProps) {
  return (
    <section className="account" aria-label="Compte">
      <button
        type="button"
        className="account-identity"
        aria-current={profileOpen ? "page" : undefined}
        aria-label={`Ouvrir le profil de ${user.name}`}
        onClick={onOpenProfile}
      >
        <Avatar user={user} />
        <div className="account-text">
          <p className="account-name">{user.name}</p>
          <p className="account-provider">via {PROVIDER_LABEL[user.provider] ?? user.provider}</p>
        </div>
      </button>
    </section>
  );
}
