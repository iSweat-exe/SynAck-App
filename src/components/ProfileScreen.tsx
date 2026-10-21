import type { AuthUser } from "../api/auth";
import { Avatar, PROVIDER_LABEL } from "./AccountCard";

interface ProfileScreenProps {
  user: AuthUser;
  solvedCount: number;
  exerciseCount: number;
  onSignOut: () => void;
}

/** The profile of the signed-in account: who it is and how far it has come. */
export function ProfileScreen({ user, solvedCount, exerciseCount, onSignOut }: ProfileScreenProps) {
  return (
    <section className="screen">
      <h2>Profil</h2>
      <div className="card profile-card">
        <Avatar user={user} size={80} />
        <div className="account-text">
          <p className="profile-name">{user.name}</p>
          <p className="account-provider">
            Connecté via {PROVIDER_LABEL[user.provider] ?? user.provider}
          </p>
        </div>
      </div>
      <div className="card setting-row">
        <div className="setting-text">
          <p className="setting-title">Exercices résolus</p>
          <p className="setting-help">Sur cet ordinateur.</p>
        </div>
        <p className="profile-stat tabular-nums">
          {solvedCount} / {exerciseCount}
        </p>
      </div>
      <div>
        <button type="button" className="btn btn-danger" onClick={onSignOut}>
          Se déconnecter
        </button>
      </div>
    </section>
  );
}
