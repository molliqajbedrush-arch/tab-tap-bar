import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Minus,
  Plus,
  Trash2,
  CreditCard,
  Banknote,
  Settings,
  X,
  Printer,
  FileText,
  Download,
  Lock,
  LogOut,
  Gift,
  MoonStar,

} from "lucide-react";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "Kasse – Gastro POS" },
      { name: "description", content: "Touch-optimiertes Kassensystem für Gastronomie im Dark Mode." },
    ],
  }),
});

type Item = { id: string; name: string; price: number };
type Category = { id: string; name: string; items: Item[] };
type CartLine = Item & { qty: number; free?: boolean };
type Sale = {
  id: string;
  receiptNo: string;
  timestamp: string; // ISO
  shiftDate?: string; // Geschäftstag (Schichtbeginn)
  lines: CartLine[];
  total: number;
  freeTotal?: number;
  given: number;
  change: number;
  payment: "Bar" | "Karte" | "Gratis";
};


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

const SALES_KEY = "pos.sales.v1";
const RECEIPT_KEY = "pos.receiptCounter.v1";
const CATS_KEY = "pos.categories.v1";
const CART_KEY = "pos.cart.v1";
const PIN_KEY = "pos.adminPin.v1";
const SESSION_KEY = "pos.session.v1";
const SHIFT_KEY = "pos.shift.v1";
const DEFAULT_PIN = "1234";

const FREE_CAT = "__free";
const FREE_CAT_NAME = "Spezial / Jeton";

type Shift = { id: string; date: string; startedAt: string };

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

const newShift = (): Shift => ({
  id: `shift-${Date.now()}`,
  date: todayKey(),
  startedAt: new Date().toISOString(),
});

const loadShift = (): Shift => {
  try {
    const raw = localStorage.getItem(SHIFT_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Shift;
      if (s && s.date) return s;
    }
  } catch {
    /* ignore */
  }
  const s = newShift();
  localStorage.setItem(SHIFT_KEY, JSON.stringify(s));
  return s;
};

const saveShift = (s: Shift) => localStorage.setItem(SHIFT_KEY, JSON.stringify(s));

const fmtDay = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};

const fmt = (n: number) =>
  n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });


const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const nextReceiptNo = () => {
  const cur = parseInt(localStorage.getItem(RECEIPT_KEY) || "0", 10) + 1;
  localStorage.setItem(RECEIPT_KEY, String(cur));
  return String(cur).padStart(6, "0");
};

const loadSales = (): Sale[] => {
  try {
    return JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
  } catch {
    return [];
  }
};
const saveSales = (s: Sale[]) => localStorage.setItem(SALES_KEY, JSON.stringify(s));

const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

function App() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(SESSION_KEY) === "1");
    setReady(true);
  }, []);

  if (!ready) return <div className="h-screen w-full bg-neutral-950" />;
  if (!authed)
    return (
      <LoginScreen
        onSuccess={() => {
          sessionStorage.setItem(SESSION_KEY, "1");
          setAuthed(true);
        }}
      />
    );
  return (
    <POS
      onLogout={() => {
        sessionStorage.removeItem(SESSION_KEY);
        setAuthed(false);
      }}
    />
  );
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    const stored = localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
    if (pin === stored) onSuccess();
    else {
      setError(true);
      setPin("");
    }
  };

  const press = (d: string) => {
    setError(false);
    setPin((p) => (p.length < 8 ? p + d : p));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") {
        setError(false);
        setPin((p) => p.slice(0, -1));
      } else if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });


  return (
    <div className="flex h-screen w-full items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="w-[380px] rounded-3xl border border-neutral-800 bg-neutral-900 p-8">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-amber-400/10 p-4">
            <Lock className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold">Admin Login</h1>
          <p className="text-sm text-neutral-500">PIN eingeben, um die Kasse zu öffnen</p>
        </div>

        <div
          className={[
            "mb-5 flex h-16 items-center justify-center rounded-2xl border text-3xl tracking-[0.5em]",
            error ? "border-red-500 text-red-400" : "border-neutral-700 bg-neutral-950",
          ].join(" ")}
        >
          {error ? "Falsch" : pin.replace(/./g, "•") || <span className="text-neutral-700">••••</span>}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => press(d)}
              className="rounded-2xl bg-neutral-800 py-5 text-2xl font-bold transition hover:bg-neutral-700 active:scale-95"
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => {
              setError(false);
              setPin("");
            }}
            className="rounded-2xl bg-neutral-800 py-5 text-base font-semibold text-neutral-400 transition hover:bg-neutral-700 active:scale-95"
          >
            C
          </button>
          <button
            onClick={() => press("0")}
            className="rounded-2xl bg-neutral-800 py-5 text-2xl font-bold transition hover:bg-neutral-700 active:scale-95"
          >
            0
          </button>
          <button
            onClick={submit}
            className="rounded-2xl bg-amber-400 py-5 text-lg font-bold text-neutral-950 transition hover:bg-amber-300 active:scale-95"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function POS({ onLogout }: { onLogout: () => void }) {
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [activeCat, setActiveCat] = useState(INITIAL_CATEGORIES[0].id);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [given, setGiven] = useState<string>("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [restored, setRestored] = useState(false);
  const [shift, setShift] = useState<Shift | null>(null);

  // Wiederherstellung nach Absturz / Neustart
  useEffect(() => {
    setSales(loadSales());
    setShift(loadShift());
    const cats = readJSON<Category[] | null>(CATS_KEY, null);
    if (cats && cats.length) {
      setCategories(cats);
      setActiveCat(cats[0].id);
    }
    const saved = readJSON<{ cart: CartLine[]; given: string } | null>(CART_KEY, null);
    if (saved) {
      setCart(saved.cart ?? []);
      setGiven(saved.given ?? "");
    }
    setRestored(true);
  }, []);

  // Laufende Sicherung
  useEffect(() => {
    if (!restored) return;
    localStorage.setItem(CATS_KEY, JSON.stringify(categories));
  }, [categories, restored]);

  useEffect(() => {
    if (!restored) return;
    localStorage.setItem(CART_KEY, JSON.stringify({ cart, given }));
  }, [cart, given, restored]);

  const isFreeCat = activeCat === FREE_CAT;
  const category = categories.find((c) => c.id === activeCat);

  // Alle Getränke aus allen Rubriken für Spezial / Jeton
  const allItems = useMemo(() => {
    const seen = new Set<string>();
    const out: Item[] = [];
    for (const c of categories) {
      for (const it of c.items) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        out.push(it);
      }
    }
    return out;
  }, [categories]);

  const gridItems = isFreeCat ? allItems : (category?.items ?? []);
  const gridTitle = isFreeCat ? FREE_CAT_NAME : (category?.name ?? "Keine Kategorie");

  useEffect(() => {
    if (isFreeCat) return;
    if (categories.length && !categories.find((c) => c.id === activeCat)) {
      setActiveCat(categories[0].id);
    }
  }, [categories, activeCat, isFreeCat]);

  const total = useMemo(
    () => cart.filter((l) => !l.free).reduce((s, l) => s + l.price * l.qty, 0),
    [cart],
  );
  const freeTotal = useMemo(
    () => cart.filter((l) => l.free).reduce((s, l) => s + l.price * l.qty, 0),
    [cart],
  );
  const givenNum = parseFloat(given.replace(",", ".")) || 0;
  const change = givenNum - total;

  const addItem = (it: Item, free = false) => {
    const lineId = free ? `free-${it.id}` : it.id;
    setCart((c) => {
      const found = c.find((l) => l.id === lineId);
      if (found) return c.map((l) => (l.id === lineId ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { ...it, id: lineId, qty: 1, ...(free ? { free: true } : {}) }];
    });
  };

  const changeQty = (id: string, d: number) =>
    setCart((c) =>
      c.map((l) => (l.id === id ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0),
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

  const finalizeSale = (payment: "Bar" | "Karte" | "Gratis") => {
    if (cart.length === 0) return;
    if (payment === "Gratis" && total > 0) return;
    if (payment !== "Gratis" && total <= 0) return;
    const sale: Sale = {
      id: `sale-${Date.now()}`,
      receiptNo: nextReceiptNo(),
      timestamp: new Date().toISOString(),
      shiftDate: shift?.date ?? todayKey(),
      lines: cart,
      total,
      freeTotal,
      given: payment === "Bar" ? givenNum || total : total,
      change: payment === "Bar" ? Math.max(0, givenNum - total) : 0,
      payment,
    };
    const next = [sale, ...loadSales()];
    saveSales(next);
    setSales(next);
    setReceiptSale(sale);
    clearCart();
  };

  const endShift = () => {
    if (cart.length > 0) {
      window.alert("Bitte offene Bestellung zuerst abschliessen oder leeren.");
      return;
    }
    if (
      !window.confirm(
        `Schicht vom ${fmtDay(shift?.date ?? todayKey())} beenden?\nEine neue Schicht startet mit dem heutigen Datum.`,
      )
    )
      return;
    const s = newShift();
    saveShift(s);
    setShift(s);
    setAdminOpen(true);
  };


  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-950 text-neutral-100 antialiased">
      {/* Left: Categories */}
      <aside className="flex w-[20%] min-w-[160px] flex-col gap-3 border-r border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-2 px-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Kategorien
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
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
          <button
            onClick={() => setActiveCat(FREE_CAT)}
            className={[
              "mt-2 flex w-full items-center gap-3 rounded-2xl px-4 py-6 text-left text-xl font-semibold transition active:scale-[0.98]",
              isFreeCat
                ? "bg-violet-500 text-neutral-950 shadow-lg shadow-violet-500/20"
                : "border border-violet-500/40 bg-neutral-800 text-violet-300 hover:bg-neutral-700",
            ].join(" ")}
          >
            <Gift className="h-6 w-6 shrink-0" />
            {FREE_CAT_NAME}
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Schicht
          </div>
          <div className="mt-1 text-base font-bold tabular-nums">
            {fmtDay(shift?.date ?? todayKey())}
          </div>
          <button
            onClick={endShift}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-800 py-3 text-sm font-bold text-neutral-200 hover:bg-neutral-700 active:scale-95"
          >
            <MoonStar className="h-4 w-4" />
            Schichtende
          </button>
        </div>
      </aside>

      {/* Middle: Items grid */}
      <main className="flex w-[50%] flex-col p-4">
        <div className="mb-3 flex items-center justify-between px-2">
          <h1
            className={[
              "text-2xl font-bold tracking-tight",
              isFreeCat ? "text-violet-300" : "",
            ].join(" ")}
          >
            {gridTitle}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-500">{gridItems.length} Artikel</span>
            <button
              onClick={() => setSalesOpen(true)}
              className="rounded-xl p-2 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
              aria-label="Buchungen"
              title="Buchungen"
            >
              <FileText className="h-5 w-5" />
            </button>
            <button
              onClick={() => setAdminOpen(true)}
              className="rounded-xl p-2 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
              aria-label="Einstellungen"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={onLogout}
              className="rounded-xl p-2 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-400"
              aria-label="Abmelden"
              title="Abmelden"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        {isFreeCat && (
          <div className="mb-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm text-violet-200">
            Gratisgetränke – werden separat gezählt und nicht zum Schichtumsatz gerechnet.
          </div>
        )}
        <div className="grid min-h-0 auto-rows-min grid-cols-3 gap-3 overflow-y-auto pr-1 xl:grid-cols-4">
          {gridItems.map((it) => (
            <button
              key={it.id}
              onClick={() => addItem(it, isFreeCat)}
              className={[
                "group flex aspect-square flex-col items-center justify-between rounded-2xl border bg-neutral-900 p-4 text-center transition active:scale-[0.97]",
                isFreeCat
                  ? "border-violet-500/30 hover:border-violet-400 hover:bg-neutral-800"
                  : "border-neutral-800 hover:border-amber-400/50 hover:bg-neutral-800",
              ].join(" ")}
            >
              <span className="flex-1 items-center flex text-lg font-semibold leading-tight text-neutral-100">
                {it.name}
              </span>
              <span
                className={[
                  "mt-2 rounded-lg bg-neutral-800 px-3 py-1 text-base font-bold group-hover:bg-neutral-950",
                  isFreeCat ? "text-violet-300" : "text-amber-400",
                ].join(" ")}
              >
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
            <div className="text-lg font-bold">
              {cart.reduce((s, l) => s + l.qty, 0)} Artikel
            </div>
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
                  className={[
                    "flex items-center gap-2 rounded-xl p-2",
                    l.free ? "bg-violet-500/10 ring-1 ring-violet-500/30" : "bg-neutral-800/60",
                  ].join(" ")}
                >
                  <div className="min-w-0 flex-1 px-2">
                    <div className="truncate font-semibold">
                      {l.name}
                      {l.free && (
                        <span className="ml-2 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                          Gratis
                        </span>
                      )}
                    </div>
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
          {freeTotal > 0 && (
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-widest text-violet-400">
                Gratis-Wert
              </span>
              <span className="text-lg font-bold tabular-nums text-violet-300">
                CHF {fmt(freeTotal)}
              </span>
            </div>
          )}
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
            onClick={() => finalizeSale("Bar")}
            disabled={cart.length === 0}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-5 text-lg font-black text-neutral-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-40"
          >
            <Banknote className="h-6 w-6" />
            Bar
          </button>
          <button
            onClick={() => finalizeSale("Karte")}
            disabled={cart.length === 0}
            className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 py-5 text-lg font-black text-neutral-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 active:scale-[0.98] disabled:opacity-40"
          >
            <CreditCard className="h-6 w-6" />
            Karte
          </button>
        </div>
      </aside>

      {adminOpen && (
        <AdminModal
          categories={categories}
          setCategories={setCategories}
          sales={sales}
          onClose={() => setAdminOpen(false)}
          onCategoryAdded={(id) => setActiveCat(id)}
        />
      )}

      {salesOpen && (
        <SalesModal
          sales={sales}
          onClose={() => setSalesOpen(false)}
          onReprint={(s) => setReceiptSale(s)}
        />
      )}

      {receiptSale && (
        <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />
      )}
    </div>
  );
}

/* ---------- Receipt (Thermobon) ---------- */

function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const print = () => window.print();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm print:static print:bg-transparent print:p-0"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl print:max-h-none print:rounded-none print:border-0 print:bg-white print:shadow-none"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 print:hidden">
          <div className="text-sm font-semibold uppercase tracking-widest text-neutral-400">
            Beleg
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Schliessen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          id="receipt-print"
          className="mx-auto w-[76mm] bg-white p-4 font-mono text-[12px] leading-snug text-black"
        >
          <div className="text-center">
            <div className="text-base font-bold">GASTRO POS</div>
            <div className="text-[11px]">Beleg / Quittung</div>
          </div>
          <div className="my-2 border-t border-dashed border-black" />
          <div className="flex justify-between">
            <span>Datum:</span>
            <span>{fmtDate(sale.timestamp)}</span>
          </div>
          <div className="flex justify-between">
            <span>Beleg-Nr.:</span>
            <span>{sale.receiptNo}</span>
          </div>
          <div className="flex justify-between">
            <span>Zahlung:</span>
            <span>{sale.payment}</span>
          </div>
          <div className="my-2 border-t border-dashed border-black" />
          <table className="w-full">
            <tbody>
              {sale.lines.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="pr-1">{l.qty}x</td>
                  <td className="pr-1">{l.name}</td>
                  <td className="text-right tabular-nums">{fmt(l.price * l.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="my-2 border-t border-dashed border-black" />
          <div className="flex justify-between text-[13px] font-bold">
            <span>TOTAL CHF</span>
            <span className="tabular-nums">{fmt(sale.total)}</span>
          </div>
          {sale.payment === "Bar" && (
            <>
              <div className="mt-1 flex justify-between">
                <span>Gegeben</span>
                <span className="tabular-nums">{fmt(sale.given)}</span>
              </div>
              <div className="flex justify-between">
                <span>Rückgeld</span>
                <span className="tabular-nums">{fmt(sale.change)}</span>
              </div>
            </>
          )}
          <div className="my-2 border-t border-dashed border-black" />
          <div className="text-center text-[11px]">Vielen Dank!</div>
        </div>

        <div className="flex gap-2 border-t border-neutral-800 p-3 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-neutral-800 py-3 text-sm font-bold hover:bg-neutral-700"
          >
            Schliessen
          </button>
          <button
            onClick={print}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-neutral-950 hover:bg-amber-300"
          >
            <Printer className="h-4 w-4" />
            Drucken
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-print, #receipt-print * { visibility: visible !important; }
          #receipt-print { position: absolute; left: 0; top: 0; width: 76mm; }
          @page { size: 80mm auto; margin: 2mm; }
        }
      `}</style>
    </div>
  );
}

/* ---------- Sales / Buchungen ---------- */

function SalesModal({
  sales,
  onClose,
  onReprint,
}: {
  sales: Sale[];
  onClose: () => void;
  onReprint: (s: Sale) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Verlauf
            </div>
            <h2 className="text-xl font-bold">Buchungen</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Schliessen"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {sales.length === 0 ? (
            <div className="rounded-xl bg-neutral-800/40 px-4 py-10 text-center text-sm text-neutral-500">
              Noch keine Buchungen
            </div>
          ) : (
            <ul className="space-y-2">
              {sales.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-4 rounded-xl bg-neutral-800/60 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-neutral-900 px-2 py-0.5 text-xs font-bold text-amber-400">
                        #{s.receiptNo}
                      </span>
                      <span className="text-sm text-neutral-400">{fmtDate(s.timestamp)}</span>
                      <span className="text-xs uppercase tracking-widest text-neutral-500">
                        {s.payment}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm text-neutral-300">
                      {s.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right text-lg font-black tabular-nums text-amber-400">
                    {fmt(s.total)}
                  </div>
                  <button
                    onClick={() => onReprint(s)}
                    className="flex items-center gap-2 rounded-xl bg-neutral-700 px-3 py-2 text-sm font-bold text-neutral-100 hover:bg-neutral-600 active:scale-95"
                  >
                    <Printer className="h-4 w-4" />
                    Nachdruck
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-neutral-800 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-neutral-800 py-4 text-base font-bold hover:bg-neutral-700"
          >
            Schliessen
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Admin (mit Z-Bericht Tab) ---------- */

function AdminModal({
  categories,
  setCategories,
  sales,
  onClose,
  onCategoryAdded,
}: {
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  sales: Sale[];
  onClose: () => void;
  onCategoryAdded: (id: string) => void;
}) {
  const [tab, setTab] = useState<"sortiment" | "zreport">("sortiment");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Einstellungen
            </div>
            <h2 className="text-xl font-bold">Admin</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Schliessen"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-neutral-800 px-6 py-3">
          {[
            { id: "sortiment", label: "Sortiment" },
            { id: "zreport", label: "Z-Bericht" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={[
                "rounded-xl px-4 py-2 text-sm font-bold transition",
                tab === t.id
                  ? "bg-amber-400 text-neutral-950"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "sortiment" ? (
            <SortimentTab
              categories={categories}
              setCategories={setCategories}
              onCategoryAdded={onCategoryAdded}
            />
          ) : (
            <ZReportTab sales={sales} />
          )}
        </div>

        <div className="border-t border-neutral-800 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-neutral-800 py-4 text-base font-bold hover:bg-neutral-700"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}

function PinSection() {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const save = () => {
    const stored = localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
    if (oldPin !== stored) return setMsg("Aktueller PIN ist falsch.");
    if (newPin.trim().length < 4) return setMsg("Neuer PIN braucht mind. 4 Zeichen.");
    localStorage.setItem(PIN_KEY, newPin.trim());
    setOldPin("");
    setNewPin("");
    setMsg("PIN gespeichert.");
  };

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h3 className="mb-3 text-lg font-bold">Admin-PIN ändern</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={oldPin}
          onChange={(e) => setOldPin(e.target.value)}
          type="password"
          inputMode="numeric"
          placeholder="Aktueller PIN"
          className="w-44 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-base outline-none focus:border-amber-400"
        />
        <input
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          type="password"
          inputMode="numeric"
          placeholder="Neuer PIN"
          className="w-44 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-base outline-none focus:border-amber-400"
        />
        <button
          onClick={save}
          className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-neutral-950 transition hover:bg-amber-300"
        >
          Speichern
        </button>
        {msg && <span className="text-sm text-neutral-400">{msg}</span>}
      </div>
    </section>
  );
}

function SortimentTab({
  categories,
  setCategories,
  onCategoryAdded,
}: {
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  onCategoryAdded: (id: string) => void;
}) {
  const [newCat, setNewCat] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCat, setItemCat] = useState(categories[0]?.id ?? "");

  useEffect(() => {
    if (!categories.find((c) => c.id === itemCat)) {
      setItemCat(categories[0]?.id ?? "");
    }
  }, [categories, itemCat]);

  const addCategory = () => {
    const name = newCat.trim();
    if (!name) return;
    const id = `cat-${Date.now()}`;
    setCategories((cs) => [...cs, { id, name, items: [] }]);
    setNewCat("");
    onCategoryAdded(id);
  };

  const deleteCategory = (id: string) => {
    setCategories((cs) => cs.filter((c) => c.id !== id));
  };

  const addItem = () => {
    const name = itemName.trim();
    const price = parseFloat(itemPrice.replace(",", "."));
    if (!name || !itemCat || isNaN(price)) return;
    const id = `it-${Date.now()}`;
    setCategories((cs) =>
      cs.map((c) =>
        c.id === itemCat ? { ...c, items: [...c.items, { id, name, price }] } : c,
      ),
    );
    setItemName("");
    setItemPrice("");
  };

  const deleteItem = (catId: string, itemId: string) => {
    setCategories((cs) =>
      cs.map((c) =>
        c.id === catId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c,
      ),
    );
  };

  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  const updateItem = (
    catId: string,
    itemId: string,
    patch: Partial<{ name: string; price: number }>,
  ) => {
    setCategories((cs) =>
      cs.map((c) =>
        c.id === catId
          ? {
              ...c,
              items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
            }
          : c,
      ),
    );
  };

  const commitPrice = (catId: string, itemId: string) => {
    const raw = priceDrafts[itemId];
    if (raw === undefined) return;
    const price = parseFloat(raw.replace(",", "."));
    if (!isNaN(price) && price >= 0) {
      updateItem(catId, itemId, { price });
    }
    setPriceDrafts((d) => {
      const { [itemId]: _, ...rest } = d;
      return rest;
    });
  };


  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <PinSection />
      </div>
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold">Kategorien verwalten</h3>
        <div className="flex gap-2">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            placeholder="Neue Kategorie"
            className="flex-1 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-base outline-none focus:border-amber-400"
          />
          <button
            onClick={addCategory}
            className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-neutral-950 hover:bg-amber-300 active:scale-95"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <ul className="space-y-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl bg-neutral-800/60 px-4 py-3"
            >
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-neutral-500">{c.items.length} Artikel</div>
              </div>
              <button
                onClick={() => deleteCategory(c.id)}
                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-700 hover:text-red-400"
                aria-label="Kategorie löschen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="rounded-xl bg-neutral-800/40 px-4 py-6 text-center text-sm text-neutral-500">
              Noch keine Kategorie
            </li>
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-bold">Getränke verwalten</h3>
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Name
          </label>
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="z.B. Gin Tonic"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-base outline-none focus:border-amber-400"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Preis (CHF)
          </label>
          <input
            inputMode="decimal"
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-base tabular-nums outline-none focus:border-amber-400"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Kategorie
          </label>
          <select
            value={itemCat}
            onChange={(e) => setItemCat(e.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-base outline-none focus:border-amber-400"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={addItem}
          disabled={!itemName.trim() || !itemPrice || !itemCat}
          className="rounded-xl bg-amber-400 px-5 py-4 text-base font-bold text-neutral-950 hover:bg-amber-300 active:scale-95 disabled:opacity-40"
        >
          Getränk hinzufügen
        </button>

      </section>

      <section className="flex flex-col gap-3 md:col-span-2">
        <h3 className="text-lg font-bold">Preise &amp; Namen bearbeiten</h3>
        <p className="text-sm text-neutral-500">
          Direkt im Feld tippen – Preis wird mit Enter oder beim Verlassen gespeichert.
        </p>
        <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-neutral-800">
          {categories.every((c) => c.items.length === 0) && (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              Noch keine Getränke erfasst
            </div>
          )}
          {categories.map((c) =>
            c.items.length === 0 ? null : (
              <div key={c.id} className="border-b border-neutral-800 last:border-b-0">
                <div className="sticky top-0 bg-neutral-800 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-300">
                  {c.name}
                </div>
                <ul className="divide-y divide-neutral-800/60">
                  {c.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 px-3 py-2">
                      <input
                        value={it.name}
                        maxLength={60}
                        onChange={(e) => updateItem(c.id, it.id, { name: e.target.value })}
                        className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-3 text-base outline-none focus:border-amber-400"
                        aria-label="Name"
                      />
                      <div className="flex shrink-0 items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 focus-within:border-amber-400">
                        <span className="text-xs text-neutral-500">CHF</span>
                        <input
                          inputMode="decimal"
                          maxLength={8}
                          value={priceDrafts[it.id] ?? it.price.toFixed(2)}
                          onChange={(e) =>
                            setPriceDrafts((d) => ({ ...d, [it.id]: e.target.value }))
                          }
                          onFocus={(e) => e.currentTarget.select()}
                          onBlur={() => commitPrice(c.id, it.id)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && (e.target as HTMLInputElement).blur()
                          }
                          className="w-24 bg-transparent py-3 text-right text-base font-bold tabular-nums outline-none"
                          aria-label="Preis"
                        />
                      </div>
                      <button
                        onClick={() => deleteItem(c.id, it.id)}
                        className="shrink-0 rounded-lg p-3 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      </section>

    </div>
  );
}

function ZReportTab({ sales }: { sales: Sale[] }) {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const daySales = useMemo(
    () => sales.filter((s) => s.timestamp.slice(0, 10) === date),
    [sales, date],
  );

  const totals = useMemo(() => {
    const cash = daySales.filter((s) => s.payment === "Bar").reduce((a, s) => a + s.total, 0);
    const card = daySales.filter((s) => s.payment === "Karte").reduce((a, s) => a + s.total, 0);
    return { cash, card, sum: cash + card, count: daySales.length };
  }, [daySales]);

  const exportCsv = () => {
    const sep = ";";
    const rows: string[] = [];
    const q = (v: string | number) => {
      const s = String(v).replace(/"/g, '""');
      return /[";\n]/.test(s) ? `"${s}"` : s;
    };
    rows.push(`Z-Bericht Tagesabschluss`);
    rows.push(`Datum${sep}${date}`);
    rows.push(`Erstellt${sep}${new Date().toLocaleString("de-CH")}`);
    rows.push("");
    rows.push(["Umsatz Bar", "Umsatz Karte", "Umsatz Total", "Anzahl Buchungen"].join(sep));
    rows.push(
      [
        fmt(totals.cash),
        fmt(totals.card),
        fmt(totals.sum),
        String(totals.count),
      ].join(sep),
    );
    rows.push("");
    rows.push("Einzelbuchungen");
    rows.push(
      ["Beleg-Nr.", "Datum/Zeit", "Zahlung", "Artikel", "Menge", "Einzelpreis", "Zeilentotal", "Beleg-Total"]
        .map(q)
        .join(sep),
    );
    for (const s of daySales) {
      for (const l of s.lines) {
        rows.push(
          [
            s.receiptNo,
            new Date(s.timestamp).toLocaleString("de-CH"),
            s.payment,
            l.name,
            l.qty,
            fmt(l.price),
            fmt(l.price * l.qty),
            fmt(s.total),
          ]
            .map(q)
            .join(sep),
        );
      }
    }
    const blob = new Blob(["\ufeff" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `z-bericht_${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Datum
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-base outline-none focus:border-amber-400"
          />
        </div>
        <button
          onClick={exportCsv}
          disabled={daySales.length === 0}
          className="ml-auto flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-base font-bold text-neutral-950 hover:bg-amber-300 disabled:opacity-40"
        >
          <Download className="h-5 w-5" />
          CSV exportieren
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Tagesumsatz" value={`CHF ${fmt(totals.sum)}`} highlight />
        <Kpi label="Bar" value={`CHF ${fmt(totals.cash)}`} />
        <Kpi label="Karte" value={`CHF ${fmt(totals.card)}`} />
        <Kpi label="Buchungen" value={String(totals.count)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <div className="grid grid-cols-[80px_1fr_80px_100px] gap-2 border-b border-neutral-800 bg-neutral-800/60 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          <span>Beleg</span>
          <span>Zeit / Artikel</span>
          <span>Zahlung</span>
          <span className="text-right">Total</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {daySales.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              Keine Buchungen an diesem Tag
            </div>
          ) : (
            daySales.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[80px_1fr_80px_100px] items-start gap-2 border-b border-neutral-800/60 px-4 py-2 text-sm last:border-b-0"
              >
                <span className="font-bold text-amber-400">#{s.receiptNo}</span>
                <div>
                  <div className="text-xs text-neutral-500">{fmtDate(s.timestamp)}</div>
                  <div className="truncate text-neutral-200">
                    {s.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                  </div>
                </div>
                <span className="text-xs uppercase tracking-widest text-neutral-400">
                  {s.payment}
                </span>
                <span className="text-right font-bold tabular-nums">{fmt(s.total)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={[
        "rounded-2xl border p-4",
        highlight
          ? "border-amber-400/40 bg-amber-400/10"
          : "border-neutral-800 bg-neutral-800/40",
      ].join(" ")}
    >
      <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
        {label}
      </div>
      <div
        className={[
          "mt-1 text-xl font-black tabular-nums",
          highlight ? "text-amber-400" : "text-neutral-100",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
