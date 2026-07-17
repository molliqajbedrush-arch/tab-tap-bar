import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2, CreditCard, Banknote, Settings, X } from "lucide-react";

export const Route = createFileRoute("/")({
  component: POS,
  head: () => ({
    meta: [
      { title: "Kasse – Gastro POS" },
      { name: "description", content: "Touch-optimiertes Kassensystem für Gastronomie im Dark Mode." },
    ],
  }),
});

type Item = { id: string; name: string; price: number };
type Category = { id: string; name: string; items: Item[] };

const INITIAL_CATEGORIES: Category[] = [
  {
    id: "mineral",
    name: "Mineral",
    items: [
      { id: "m1", name: "Wasser still", price: 4.5 },
      { id: "m2", name: "Wasser mit", price: 4.5 },
      { id: "m3", name: "Coca-Cola", price: 5 },
      { id: "m4", name: "Cola Zero", price: 5 },
      { id: "m5", name: "Rivella", price: 5 },
      { id: "m6", name: "Sprite", price: 5 },
      { id: "m7", name: "Fanta", price: 5 },
      { id: "m8", name: "Red Bull", price: 7 },
    ],
  },
  {
    id: "bier",
    name: "Bier",
    items: [
      { id: "b1", name: "Feldschlösschen", price: 6 },
      { id: "b2", name: "Quöllfrisch", price: 6.5 },
      { id: "b3", name: "Heineken", price: 7 },
      { id: "b4", name: "Corona", price: 8 },
      { id: "b5", name: "Weizen", price: 7.5 },
      { id: "b6", name: "IPA", price: 8 },
      { id: "b7", name: "Alkoholfrei", price: 5.5 },
      { id: "b8", name: "Panaché", price: 6 },
    ],
  },
  {
    id: "longdrinks",
    name: "Longdrinks",
    items: [
      { id: "l1", name: "Gin Tonic", price: 14 },
      { id: "l2", name: "Vodka Red Bull", price: 15 },
      { id: "l3", name: "Cuba Libre", price: 13 },
      { id: "l4", name: "Whisky Cola", price: 14 },
      { id: "l5", name: "Moscow Mule", price: 15 },
      { id: "l6", name: "Aperol Spritz", price: 13 },
      { id: "l7", name: "Hugo", price: 12 },
      { id: "l8", name: "Caipirinha", price: 15 },
    ],
  },
  {
    id: "shots",
    name: "Shots",
    items: [
      { id: "s1", name: "Tequila", price: 6 },
      { id: "s2", name: "Jägermeister", price: 6 },
      { id: "s3", name: "Sambuca", price: 6 },
      { id: "s4", name: "Vodka", price: 5 },
      { id: "s5", name: "Fireball", price: 7 },
      { id: "s6", name: "Baileys", price: 6 },
    ],
  },
];

type CartLine = Item & { qty: number };

function POS() {
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [activeCat, setActiveCat] = useState(INITIAL_CATEGORIES[0].id);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [given, setGiven] = useState<string>("");
  const [adminOpen, setAdminOpen] = useState(false);

  const category =
    categories.find((c) => c.id === activeCat) ?? categories[0];

  useEffect(() => {
    if (categories.length && !categories.find((c) => c.id === activeCat)) {
      setActiveCat(categories[0].id);
    }
  }, [categories, activeCat]);

  const total = useMemo(
    () => cart.reduce((s, l) => s + l.price * l.qty, 0),
    [cart],
  );
  const givenNum = parseFloat(given.replace(",", ".")) || 0;
  const change = givenNum - total;

  const addItem = (it: Item) =>
    setCart((c) => {
      const found = c.find((l) => l.id === it.id);
      if (found) return c.map((l) => (l.id === it.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { ...it, qty: 1 }];
    });

  const changeQty = (id: string, d: number) =>
    setCart((c) =>
      c
        .map((l) => (l.id === id ? { ...l, qty: l.qty + d } : l))
        .filter((l) => l.qty > 0),
    );

  const clearCart = () => {
    setCart([]);
    setGiven("");
  };

  const addToGiven = (n: number) =>
    setGiven((g) => {
      const cur = parseFloat(g.replace(",", ".")) || 0;
      return String(cur + n);
    });

  const fmt = (n: number) =>
    n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-950 text-neutral-100 antialiased">
      {/* Left: Categories */}
      <aside className="flex w-[20%] min-w-[160px] flex-col gap-3 border-r border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-2 px-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Kategorien
          </div>
        </div>
        {categories.map((c) => {
          const active = c.id === activeCat;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={[
                "w-full rounded-2xl px-4 py-6 text-left text-xl font-semibold transition active:scale-[0.98]",
                active
                  ? "bg-amber-400 text-neutral-950 shadow-lg shadow-amber-400/20"
                  : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700",
              ].join(" ")}
            >
              {c.name}
            </button>
          );
        })}
      </aside>

      {/* Middle: Items grid */}
      <main className="flex w-[50%] flex-col p-4">
        <div className="mb-3 flex items-baseline justify-between px-2">
          <h1 className="text-2xl font-bold tracking-tight">{category.name}</h1>
          <span className="text-sm text-neutral-500">{category.items.length} Artikel</span>
        </div>
        <div className="grid grid-cols-3 gap-3 overflow-y-auto pr-1 xl:grid-cols-4">
          {category.items.map((it) => (
            <button
              key={it.id}
              onClick={() => addItem(it)}
              className="group flex aspect-square flex-col items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-center transition hover:border-amber-400/50 hover:bg-neutral-800 active:scale-[0.97]"
            >
              <span className="flex-1 items-center flex text-lg font-semibold leading-tight text-neutral-100">
                {it.name}
              </span>
              <span className="mt-2 rounded-lg bg-neutral-800 px-3 py-1 text-base font-bold text-amber-400 group-hover:bg-neutral-950">
                CHF {fmt(it.price)}
              </span>
            </button>
          ))}
        </div>
      </main>

      {/* Right: Cart */}
      <aside className="flex w-[30%] min-w-[300px] flex-col border-l border-neutral-800 bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Bestellung
            </div>
            <div className="text-lg font-bold">{cart.reduce((s, l) => s + l.qty, 0)} Artikel</div>
          </div>
          <button
            onClick={clearCart}
            disabled={cart.length === 0}
            className="rounded-xl p-2 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-400 disabled:opacity-30"
            aria-label="Leeren"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {cart.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-600">
              Noch keine Artikel
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-2 rounded-xl bg-neutral-800/60 p-2"
                >
                  <div className="min-w-0 flex-1 px-2">
                    <div className="truncate font-semibold">{l.name}</div>
                    <div className="text-xs text-neutral-400">CHF {fmt(l.price)}</div>
                  </div>
                  <button
                    onClick={() => changeQty(l.id, -1)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-neutral-700 text-lg font-bold hover:bg-neutral-600 active:scale-95"
                    aria-label="Weniger"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-lg font-bold tabular-nums">{l.qty}</span>
                  <button
                    onClick={() => changeQty(l.id, 1)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-neutral-700 text-lg font-bold hover:bg-neutral-600 active:scale-95"
                    aria-label="Mehr"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <div className="w-20 shrink-0 text-right font-bold tabular-nums">
                    {fmt(l.price * l.qty)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-neutral-800 px-5 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm uppercase tracking-widest text-neutral-500">Total</span>
            <span className="text-3xl font-black tabular-nums text-amber-400">
              CHF {fmt(total)}
            </span>
          </div>
        </div>

        <div className="space-y-3 border-t border-neutral-800 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Gegeben
            </label>
            <input
              inputMode="decimal"
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-xl font-bold tabular-nums text-neutral-100 outline-none focus:border-amber-400"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[10, 20, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => addToGiven(n)}
                className="rounded-xl bg-neutral-800 py-3 text-base font-bold text-neutral-100 hover:bg-neutral-700 active:scale-95"
              >
                +{n}
              </button>
            ))}
          </div>
          <div className="flex items-baseline justify-between rounded-xl bg-neutral-800/50 px-4 py-2">
            <span className="text-sm uppercase tracking-widest text-neutral-500">Rückgeld</span>
            <span
              className={[
                "text-2xl font-black tabular-nums",
                change < 0 ? "text-red-400" : "text-emerald-400",
              ].join(" ")}
            >
              CHF {fmt(Math.max(0, change))}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-neutral-800 p-3">
          <button
            onClick={clearCart}
            disabled={cart.length === 0}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-5 text-lg font-black text-neutral-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-40"
          >
            <Banknote className="h-6 w-6" />
            Bar
          </button>
          <button
            onClick={clearCart}
            disabled={cart.length === 0}
            className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 py-5 text-lg font-black text-neutral-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 active:scale-[0.98] disabled:opacity-40"
          >
            <CreditCard className="h-6 w-6" />
            Karte
          </button>
        </div>
      </aside>
    </div>
  );
}
