import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Plansza from './komponenty/Plansza';
import {
  NAZWY_POZIOMOW,
  OPISY_POZIOMOW,
  Poziom,
  ruchAI,
  ruchAIUltimate,
} from './gra/ai';
import {
  NAZWY_TRYBOW,
  OPISY_TRYBOW,
  Pole,
  Rozstrzygniecie,
  StanUltimate,
  Tryb,
  ZASADY,
  Znak,
  oceń,
  oceńUltimate,
  planszaDostepna,
  przeciwnik,
  pustaPlansza,
  pustyUltimate,
  ruchUltimate,
} from './gra/logika';

type Przeciwnik = 'ai' | 'czlowiek';
type Ekran = 'menu' | 'gra';

interface Wynik {
  X: number;
  O: number;
  remisy: number;
}

const PUSTY_WYNIK: Wynik = { X: 0, O: 0, remisy: 0 };
const KLUCZ = 'kolko-krzyzyk-wyniki';

/** Krótkie drgnięcie telefonu przy ruchu i przy końcu partii. Na desktopie
 *  Vibration API nie istnieje, więc wywołanie jest bezpiecznie pomijane. */
function zadrgaj(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* część przeglądarek rzuca przy zablokowanej wibracji — nieistotne */
  }
}

function wczytajWyniki(): Record<string, Wynik> {
  try {
    const s = localStorage.getItem(KLUCZ);
    if (s) return JSON.parse(s);
  } catch {
    /* prywatne okno albo zablokowane dane — gramy bez historii */
  }
  return {};
}

export default function App() {
  const [ekran, setEkran] = useState<Ekran>('menu');
  const [tryb, setTryb] = useState<Tryb>('klasyk');
  const [rywal, setRywal] = useState<Przeciwnik>('ai');
  const [poziom, setPoziom] = useState<Poziom>('sredni');

  const zasady = ZASADY[tryb];

  const [plansza, setPlansza] = useState<Pole[]>(() => pustaPlansza(zasady.bok));
  const [ultimate, setUltimate] = useState<StanUltimate>(pustyUltimate);
  const [naRuchu, setNaRuchu] = useState<Znak>('X');
  const [ostatnie, setOstatnie] = useState<number | null>(null);
  const [historia, setHistoria] = useState<{ plansza: Pole[]; ultimate: StanUltimate; naRuchu: Znak }[]>([]);
  const [wyniki, setWyniki] = useState<Record<string, Wynik>>(wczytajWyniki);
  const [mysli, setMysli] = useState(false);

  const wynik = wyniki[tryb] ?? PUSTY_WYNIK;
  const czlowiekGra: Znak = 'X';

  const rozstrzygniecie: Rozstrzygniecie = useMemo(
    () => (tryb === 'ultimate' ? oceńUltimate(ultimate) : oceń(plansza, zasady)),
    [tryb, ultimate, plansza, zasady]
  );
  const koniec = rozstrzygniecie.zwyciezca !== null || rozstrzygniecie.remis;

  const zapiszWynik = useCallback(
    (r: Rozstrzygniecie) => {
      setWyniki((prev) => {
        const stary = prev[tryb] ?? PUSTY_WYNIK;
        const nowy: Wynik = r.zwyciezca
          ? { ...stary, [r.zwyciezca]: stary[r.zwyciezca] + 1 }
          : { ...stary, remisy: stary.remisy + 1 };
        const cale = { ...prev, [tryb]: nowy };
        try {
          localStorage.setItem(KLUCZ, JSON.stringify(cale));
        } catch {
          /* brak zapisu nie może przerwać gry */
        }
        return cale;
      });
    },
    [tryb]
  );

  // Wynik dopisujemy raz na partię — stąd strażnik na id rozstrzygnięcia.
  const zapisane = useRef<string | null>(null);
  useEffect(() => {
    if (!koniec) {
      zapisane.current = null;
      return;
    }
    const id = `${tryb}:${rozstrzygniecie.zwyciezca ?? 'remis'}:${historia.length}`;
    if (zapisane.current === id) return;
    zapisane.current = id;
    zapiszWynik(rozstrzygniecie);
    zadrgaj(rozstrzygniecie.zwyciezca ? [40, 60, 120] : 40);
  }, [koniec, rozstrzygniecie, tryb, historia.length, zapiszWynik]);

  const nowaPartia = useCallback(
    (t: Tryb = tryb) => {
      setPlansza(pustaPlansza(ZASADY[t].bok));
      setUltimate(pustyUltimate());
      setNaRuchu('X');
      setOstatnie(null);
      setHistoria([]);
      setMysli(false);
      zapisane.current = null;
    },
    [tryb]
  );

  const zapamietaj = useCallback(() => {
    setHistoria((h) => [...h, { plansza, ultimate, naRuchu }].slice(-40));
  }, [plansza, ultimate, naRuchu]);

  const cofnij = useCallback(() => {
    setHistoria((h) => {
      if (h.length === 0) return h;
      // Przy grze z AI cofamy dwa półruchy, żeby wrócić do własnej kolei.
      const ile = rywal === 'ai' && h.length >= 2 && !koniec ? 2 : 1;
      const cel = h[h.length - ile];
      setPlansza(cel.plansza);
      setUltimate(cel.ultimate);
      setNaRuchu(cel.naRuchu);
      setOstatnie(null);
      setMysli(false);
      zapisane.current = null;
      return h.slice(0, h.length - ile);
    });
  }, [rywal, koniec]);

  const zagraj = useCallback(
    (i: number, planszaUltimate?: number) => {
      if (koniec || mysli) return;
      if (tryb === 'ultimate') {
        if (planszaUltimate === undefined) return;
        const po = ruchUltimate(ultimate, planszaUltimate, i, naRuchu);
        if (!po) return;
        zapamietaj();
        setUltimate(po);
        setOstatnie(planszaUltimate * 9 + i);
      } else {
        if (plansza[i] !== null) return;
        zapamietaj();
        const nowa = [...plansza];
        nowa[i] = naRuchu;
        setPlansza(nowa);
        setOstatnie(i);
      }
      setNaRuchu((z) => przeciwnik(z));
      zadrgaj(12);
    },
    [koniec, mysli, tryb, ultimate, naRuchu, plansza, zapamietaj]
  );

  // Ruch komputera. Odpalany po zmianie stanu, z krótką pauzą — bez niej
  // AI odpowiada w tej samej klatce i wygląda to jak błąd, a nie jak ruch.
  useEffect(() => {
    if (ekran !== 'gra' || rywal !== 'ai' || koniec) return;
    if (naRuchu === czlowiekGra) return;

    setMysli(true);
    const t = setTimeout(() => {
      if (tryb === 'ultimate') {
        const r = ruchAIUltimate(ultimate, naRuchu, poziom);
        if (r) {
          const po = ruchUltimate(ultimate, r.plansza, r.pole, naRuchu);
          if (po) {
            setUltimate(po);
            setOstatnie(r.plansza * 9 + r.pole);
          }
        }
      } else {
        const i = ruchAI(plansza, zasady, naRuchu, poziom);
        if (i !== null) {
          setPlansza((p) => {
            const n = [...p];
            n[i] = naRuchu;
            return n;
          });
          setOstatnie(i);
        }
      }
      setNaRuchu((z) => przeciwnik(z));
      setMysli(false);
    }, 320);

    return () => clearTimeout(t);
  }, [ekran, rywal, koniec, naRuchu, tryb, ultimate, plansza, zasady, poziom]);

  /* ────────────────────────────── menu ────────────────────────────── */

  if (ekran === 'menu') {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-5 px-4 pb-[max(1rem,var(--sa-bottom))] pt-[max(1.5rem,var(--sa-top))]">
        <header className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Kółko <span className="text-amber-400">&</span> Krzyżyk
          </h1>
          <p className="mt-1 text-sm text-slate-400">Cztery tryby, trzy poziomy przeciwnika</p>
        </header>

        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-slate-500">
            Tryb gry
          </h2>
          <div className="flex flex-col gap-2">
            {(Object.keys(NAZWY_TRYBOW) as Tryb[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTryb(t)}
                className={[
                  'rounded-2xl border p-4 text-left transition-colors',
                  t === tryb
                    ? 'border-amber-400/70 bg-amber-500/10'
                    : 'border-slate-700/60 bg-slate-800/40 active:bg-slate-700/50',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-lg font-bold text-white">{NAZWY_TRYBOW[t]}</span>
                  {t === tryb && <span className="text-amber-400">✓</span>}
                </div>
                <p className="mt-1 text-sm leading-snug text-slate-400">{OPISY_TRYBOW[t]}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-slate-500">
            Przeciwnik
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['ai', 'Komputer'],
              ['czlowiek', 'Dwie osoby'],
            ] as [Przeciwnik, string][]).map(([w, etykieta]) => (
              <button
                key={w}
                type="button"
                onClick={() => setRywal(w)}
                className={[
                  'min-h-[52px] rounded-xl border px-3 text-base font-semibold transition-colors',
                  w === rywal
                    ? 'border-amber-400/70 bg-amber-500/10 text-white'
                    : 'border-slate-700/60 bg-slate-800/40 text-slate-300 active:bg-slate-700/50',
                ].join(' ')}
              >
                {etykieta}
              </button>
            ))}
          </div>

          {rywal === 'ai' && (
            <div className="mt-3">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(NAZWY_POZIOMOW) as Poziom[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPoziom(p)}
                    className={[
                      'min-h-[48px] rounded-xl border px-2 text-sm font-semibold transition-colors',
                      p === poziom
                        ? 'border-sky-400/70 bg-sky-500/10 text-white'
                        : 'border-slate-700/60 bg-slate-800/40 text-slate-300 active:bg-slate-700/50',
                    ].join(' ')}
                  >
                    {NAZWY_POZIOMOW[p]}
                  </button>
                ))}
              </div>
              <p className="mt-2 px-1 text-xs leading-snug text-slate-500">
                {OPISY_POZIOMOW[poziom]}
              </p>
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={() => {
            nowaPartia(tryb);
            setEkran('gra');
          }}
          className="mt-auto min-h-[56px] rounded-2xl bg-amber-500 text-lg font-black text-slate-950 shadow-lg shadow-amber-900/30 active:scale-[0.98]"
        >
          Graj
        </button>
      </div>
    );
  }

  /* ────────────────────────────── gra ────────────────────────────── */

  const komunikat = rozstrzygniecie.zwyciezca
    ? rywal === 'ai'
      ? rozstrzygniecie.zwyciezca === czlowiekGra
        ? 'Wygrywasz!'
        : 'Komputer wygrywa'
      : `Wygrywa ${rozstrzygniecie.zwyciezca}`
    : rozstrzygniecie.remis
      ? 'Remis'
      : mysli
        ? 'Komputer myśli…'
        : rywal === 'ai' && naRuchu !== czlowiekGra
          ? 'Ruch komputera'
          : `Ruch gracza ${naRuchu}`;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-3 px-3 pb-[max(0.75rem,var(--sa-bottom))] pt-[max(0.75rem,var(--sa-top))]">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEkran('menu')}
          aria-label="Wróć do menu"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800/60 text-xl text-slate-300 active:bg-slate-700"
        >
          ←
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-bold text-white">{NAZWY_TRYBOW[tryb]}</div>
          <div className="truncate text-xs text-slate-400">
            {rywal === 'ai' ? `Komputer · ${NAZWY_POZIOMOW[poziom]}` : 'Dwie osoby'}
          </div>
        </div>
        <button
          type="button"
          onClick={cofnij}
          disabled={historia.length === 0 || mysli}
          aria-label="Cofnij ruch"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800/60 text-xl text-slate-300 active:bg-slate-700 disabled:opacity-30"
        >
          ↩
        </button>
      </header>

      <div className="grid grid-cols-3 gap-2 text-center">
        {([
          ['X', wynik.X, 'text-amber-300'],
          ['Remisy', wynik.remisy, 'text-slate-300'],
          ['O', wynik.O, 'text-sky-300'],
        ] as [string, number, string][]).map(([etykieta, ile, kolor]) => (
          <div key={etykieta} className="rounded-xl bg-slate-800/40 py-2">
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
              {etykieta}
            </div>
            <div className={`text-xl font-black ${kolor}`}>{ile}</div>
          </div>
        ))}
      </div>

      <div
        aria-live="polite"
        className={[
          'rounded-xl py-2 text-center text-base font-bold',
          koniec ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-300',
        ].join(' ')}
      >
        {komunikat}
      </div>

      <div className="flex flex-1 items-center justify-center">
        {tryb === 'ultimate' ? (
          <div
            className="grid w-full gap-1.5 rounded-2xl bg-slate-900/60 p-1.5"
            style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
          >
            {ultimate.male.map((mala, p) => {
              const zdobyta = ultimate.wyniki[p];
              const dostepna = !koniec && planszaDostepna(ultimate, p);
              return (
                <div
                  key={p}
                  className={[
                    'relative rounded-xl p-1 transition-colors',
                    dostepna ? 'bg-amber-500/15 ring-2 ring-amber-400/60' : 'bg-slate-800/30',
                  ].join(' ')}
                >
                  <Plansza
                    pola={mala}
                    bok={3}
                    mini
                    zablokowana={!dostepna}
                    onPole={(i) => zagraj(i, p)}
                  />
                  {zdobyta && (
                    <div
                      className={[
                        'absolute inset-0 flex items-center justify-center rounded-xl text-5xl font-black backdrop-blur-[2px]',
                        zdobyta === 'remis'
                          ? 'bg-slate-900/80 text-slate-500'
                          : zdobyta === 'X'
                            ? 'bg-amber-950/70 text-amber-300'
                            : 'bg-sky-950/70 text-sky-300',
                      ].join(' ')}
                    >
                      {zdobyta === 'remis' ? '–' : zdobyta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Plansza
            pola={plansza}
            bok={zasady.bok}
            linia={rozstrzygniecie.linia}
            ostatnie={ostatnie}
            zablokowana={koniec || mysli || (rywal === 'ai' && naRuchu !== czlowiekGra)}
            onPole={(i) => zagraj(i)}
          />
        )}
      </div>

      {tryb === 'ultimate' && !koniec && (
        <p className="text-center text-xs leading-snug text-slate-500">
          {ultimate.aktywna === null
            ? 'Zagraj na dowolnej podświetlonej planszy'
            : 'Grasz na podświetlonej planszy — wyznaczył ją poprzedni ruch'}
        </p>
      )}

      <button
        type="button"
        onClick={() => nowaPartia()}
        className="min-h-[52px] rounded-2xl bg-slate-100 text-base font-black text-slate-900 active:scale-[0.98]"
      >
        {koniec ? 'Jeszcze raz' : 'Od nowa'}
      </button>
    </div>
  );
}
