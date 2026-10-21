import { useEffect, useRef } from "react";
import { CATEGORIES, CATEGORY_LABEL, ITEMS, missingCoins, type ShopItem } from "../shop/catalog";
import { NavIcon } from "./NavIcon";
import { ShopArt } from "./ShopArt";

const SOON = "Bientôt disponible";

function Item({ item, coins }: { item: ShopItem; coins: number }) {
  const missing = missingCoins(item, coins);

  return (
    // The whole card is the host of its drawing: hovering anywhere on it plays the animation.
    <li className="card shop-item" data-icon-host>
      <div className="shop-art-tile">
        <ShopArt art={item.art} />
      </div>
      <div className="shop-item-text">
        <h4 className="shop-item-name">{item.name}</h4>
        <p className="shop-item-description">{item.description}</p>
      </div>
      <div className="shop-item-footer">
        <span className="shop-price tabular-nums" data-short={missing > 0}>
          <NavIcon name="coin" />
          {item.price}
        </span>
        <button type="button" className="btn btn-secondary" disabled title={SOON}>
          Acheter
        </button>
      </div>
      <p className="shop-missing tabular-nums">
        {missing > 0
          ? `Il te manque ${String(missing)} pièces.`
          : "Tu as assez de pièces pour cet article."}
      </p>
    </li>
  );
}

interface ShopDialogProps {
  open: boolean;
  coins: number;
  onClose: () => void;
}

/**
 * The shop: a window over the whole application, with a margin all round, that darkens what is
 * behind it a little. It is a native `<dialog>` so that the browser keeps the focus inside it,
 * closes it on Escape and makes the page behind it inert. Nothing can be bought yet.
 */
export function ShopDialog({ open, coins, onClose }: ShopDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="shop"
      aria-labelledby="shop-title"
      onClose={onClose}
      // A click on the dark area around the window lands on the dialog itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="shop-header">
        <div className="shop-heading">
          <h2 id="shop-title">Boutique</h2>
          <p>Dépense tes pièces pour obtenir des avantages dans l&apos;application.</p>
        </div>
        <span className="badge badge-warning">Achats bientôt disponibles</span>
        <span className="shop-balance tabular-nums" aria-label={`${String(coins)} pièces`}>
          <NavIcon name="coin" />
          {coins}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="Fermer la boutique"
          onClick={onClose}
        >
          <NavIcon name="close" />
        </button>
      </header>

      <div className="shop-body">
        {CATEGORIES.map((category) => (
          <section key={category} aria-labelledby={`shop-${category}`} className="shop-shelf">
            <h3 className="label" id={`shop-${category}`}>
              {CATEGORY_LABEL[category]}
            </h3>
            <ul className="shop-grid">
              {ITEMS.filter((item) => item.category === category).map((item) => (
                <Item key={item.id} item={item} coins={coins} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="shop-footer">
        Gagne des pièces en résolvant des exercices et en validant des protocoles.
      </footer>
    </dialog>
  );
}
