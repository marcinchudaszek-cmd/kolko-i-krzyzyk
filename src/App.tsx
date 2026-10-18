import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Plansza from './komponenty/Plansza';
import {
  NAZWY_POZIOMOW,
  OPISY_POZIOMOW,
  Poziom,
  ruchAI,
  ruchAIUltimate,
  ruchAIZnikajace,
} from './gra/ai';
import {
  NAZWY_TRYBOW,
  OPISY_TRYBOW,
  Pole,
  Rozstrzygniecie,
  StanUltimate,
  StanZnikajace,
  Tryb,
  ZASADY,
  Znak,
  LIMIT_ZNIKAJACE,
  oceń,
  oceńUltimate,
  planszaDostepna,
  poleWKolumnie,
  przeciwnik,
  pustaDla,
  pustyUltimate,
  pustyZnikajace,
  ruchUltimate,
  ruchZnikajacy,
  znikaNastepne,
} from './gra/logika';
import {
  KAMPANIA,
  ODZNAKI,
  Odznaka,
  Profil,
  WSZYSTKIE_TRYBY,
  poMeczu,
  poPartii,
  wczytajProfil,
  zapiszProfil,
} from './gra/profil';

type Przeciwnik = 'ai' | 'czlowiek';
type Ekran = 'menu' | 'gra';
type Zakladka = 'szybka' | 'kampania' | 'odznaki';

interface Wynik {
  X: number;
  O: number;
  remisy: number;
}

/** Ustawienia partii, zamrożone w chwili startu (szybka gra albo etap kampanii). */
interface Konfig {
  tryb: Tryb;
  rywal: Przeciwnik;
  poziom: Poziom;
  /** Znak człowieka przy grze z komputerem. */
  znakGracza: Znak;
  doWygranych: number;
  etap: number | null;
}

interface Partia {
  plansza: Pole[];
  ultimate: StanUltimate;
  znik: StanZnikajace;
  naRuchu: Znak;
  ostatnie: number | null;
  polRuchow: number;
}

interface Mecz {
  /** Wygrane człowieka (z komputerem) albo X (we dwoje). */
  ja: number;
  /** Wygrane komputera albo O. */
  on: number;
  remisy: number;
  /** Kto zaczyna bieżącą partię — na zmianę. */
  zaczyna: Znak;
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

const nowaPartiaDla = (t: Tryb, zaczyna: Znak): Partia => ({
  plansza: pustaDla(ZASADY[t]),
  ultimate: pustyUltimate(),
  znik: pustyZnikajace(),
  naRuchu: zaczyna,
  ostatnie: null,
  polRuchow: 0,
});

/** Ruch: pole (albo pole na małej planszy w Ultimate). Zwraca nową partię
 *  albo null, gdy ruch jest niedozwolony. */
function wykonaj(partia: Partia, tryb: Tryb, pole: number, malaPlansza?: number): Partia | null {
  const z = ZASADY[tryb];
  const znak = partia.naRuchu;
  const dalej = { naRuchu: przeciwnik(znak), polRuchow: partia.polRuchow + 1 };
  if (tryb === 'ultimate') {
    if (malaPlansza === undefined) return null;
    const po = ruchUltimate(partia.ultimate, malaPlansza, pole, znak);
    return po ? { ...partia, ...dalej, ultimate: po, ostatnie: malaPlansza * 9 + pole } : null;
  }
  if (tryb === 'znikajace') {
    const po = ruchZnikajacy(partia.znik, pole, znak, z.znikanie);
    return po ? { ...partia, ...dalej, znik: po, ostatnie: pole } : null;
  }
  // Czwórki: liczy się kolumna, krążek spada na najniższe wolne pole
  const cel = z.grawitacja ? poleWKolumnie(partia.plansza, z, pole % z.bok) : pole;
  if (cel === null || partia.plansza[cel] !== null) return null;
  const plansza = [...partia.plansza];
  plansza[cel] = znak;
  return { ...partia, ...dalej, plansza, ostatnie: cel };
}

/** Ruch komputera (albo podpowiedź dla gracza, liczona jak mistrz). */
function ruchKomputera(partia: Partia, tryb: Tryb, znak: Znak, poziom: Poziom): { pole: number; mala?: number } | null {
  if (tryb === 'ultimate') {
    const r = ruchAIUltimate(partia.ultimate, znak, poziom);
    return r ? { pole: r.pole, mala: r.plansza } : null;
  }
  if (tryb === 'znikajace') {
    const i = ruchAIZnikajace(partia.znik, znak, poziom);
    return i === null ? null : { pole: i };
  }
  const i = ruchAI(partia.plansza, ZASADY[tryb], znak, poziom);
  return i === null ? null : { pole: i };
}

export default function App() {
  const [ekran, setEkran] = useState<Ekran>('menu');
  const [zakladka, setZakladka] = useState<Zakladka>('szybka');

  // ustawienia szybkiej gry
  const [tryb, setTryb] = useState<Tryb>('klasyk');
  const [rywal, setRywal] = useState<Przeciwnik>('ai');
  const [poziom, setPoziom] = useState<Poziom>('sredni');
  const [znakGracza, setZnakGracza] = useState<Znak>('X');
  const [doWygranych, setDoWygranych] = useState(1);

  const [konf, setKonf] = useState<Konfig>({ tryb: 'klasyk', rywal: 'ai', poziom: 'sredni', znakGracza: 'X', doWygranych: 1, etap: null });
  const [partia, setPartia] = useState<Partia>(() => nowaPartiaDla('klasyk', 'X'));
  const [historia, setHistoria] = useState<Partia[]>([]);
  const [mecz, setMecz] = useState<Mecz>({ ja: 0, on: 0, remisy: 0, zaczyna: 'X' });
  const [mysli, setMysli] = useState(false);
  const [podpowiedz, setPodpowiedz] = useState<{ pole: number; mala?: number } | null>(null);
  const [podpowiedzi, setPodpowiedzi] = useState(0);

  const [wyniki, setWyniki] = useState<Record<string, Wynik>>(wczytajWyniki);
  const [profil, setProfil] = useState<Profil>(wczytajProfil);
  const [toast, setToast] = useState<Odznaka[]>([]);

  const zasady = ZASADY[konf.tryb];
  const zAI = konf.rywal === 'ai';
  const czlowiek = konf.znakGracza;
  const wynik = wyniki[konf.tryb] ?? PUSTY_WYNIK;

  const rozstrzygniecie: Rozstrzygniecie = useMemo(() => {
    if (konf.tryb === 'ultimate') return oceńUltimate(partia.ultimate);
    if (konf.tryb === 'znikajace') {
      const r = oceń(partia.znik.plansza, zasady);
      return r.zwyciezca ? r : { ...r, remis: partia.polRuchow >= LIMIT_ZNIKAJACE };
    }
    return oceń(partia.plansza, zasady);
  }, [konf.tryb, partia, zasady]);
  const koniec = rozstrzygniecie.zwyciezca !== null || rozstrzygniecie.remis;
  const meczRozstrzygniety = mecz.ja >= konf.doWygranych || mecz.on >= konf.doWygranych;

  // Toasty odznak znikają same
  useEffect(() => {
    if (!toast.length) return;
    const t = setTimeout(() => setToast(q => q.slice(1)), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Koniec partii: wynik, mecz, profil i odznaki — raz na partię.
  const zapisane = useRef<string | null>(null);
  useEffect(() => {
    if (!koniec) {
      zapisane.current = null;
      return;
    }
    const id = `${konf.tryb}:${rozstrzygniecie.zwyciezca ?? 'remis'}:${partia.polRuchow}:${historia.length}`;
    if (zapisane.current === id) return;
    zapisane.current = id;

    const zw = rozstrzygniecie.zwyciezca;
    setWyniki(prev => {
      const stary = prev[konf.tryb] ?? PUSTY_WYNIK;
      const nowy: Wynik = zw ? { ...stary, [zw]: stary[zw] + 1 } : { ...stary, remisy: stary.remisy + 1 };
      const cale = { ...prev, [konf.tryb]: nowy };
      try { localStorage.setItem(KLUCZ, JSON.stringify(cale)); } catch { /* brak zapisu nie przerywa gry */ }
      return cale;
    });

    const mojaStrona: Znak = zAI ? czlowiek : 'X';
    const nowyMecz: Mecz = {
      ...mecz,
      ja: mecz.ja + (zw === mojaStrona ? 1 : 0),
      on: mecz.on + (zw && zw !== mojaStrona ? 1 : 0),
      remisy: mecz.remisy + (zw ? 0 : 1),
    };
    setMecz(nowyMecz);

    const wynikGracza = !zw ? 'remis' : zw === czlowiek ? 'wygrana' : 'przegrana';
    let { profil: p, nowe } = poPartii(profil, {
      tryb: konf.tryb,
      przeciwnikAI: zAI ? konf.poziom : null,
      wynik: wynikGracza,
      podpowiedzi,
    });
    if (zAI && (nowyMecz.ja >= konf.doWygranych || nowyMecz.on >= konf.doWygranych)) {
      const m = poMeczu(p, konf.doWygranych, nowyMecz.ja >= konf.doWygranych, konf.etap);
      p = m.profil;
      nowe = [...nowe, ...m.nowe];
    }
    setProfil(p);
    zapiszProfil(p);
    if (nowe.length) setToast(q => [...q, ...nowe]);
    zadrgaj(zw ? [40, 60, 120] : 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [koniec]);

  const startuj = (k: Konfig) => {
    setKonf(k);
    setMecz({ ja: 0, on: 0, remisy: 0, zaczyna: 'X' });
    setPartia(nowaPartiaDla(k.tryb, 'X'));
    setHistoria([]);
    setMysli(false);
    setPodpowiedz(null);
    setPodpowiedzi(0);
    zapisane.current = null;
    setEkran('gra');
  };

  /** Następna partia meczu (zaczyna druga strona) albo nowy mecz. */
  const nastepnaPartia = () => {
    const nowyMecz = meczRozstrzygniety && koniec;
    const zaczyna: Znak = przeciwnik(mecz.zaczyna);
    setMecz(m => (nowyMecz ? { ja: 0, on: 0, remisy: 0, zaczyna } : { ...m, zaczyna }));
    setPartia(nowaPartiaDla(konf.tryb, zaczyna));
    setHistoria([]);
    setMysli(false);
    setPodpowiedz(null);
    setPodpowiedzi(0);
    zapisane.current = null;
  };

  /** Od nowa bez liczenia wyniku — ta sama strona zaczyna. */
  const odNowa = () => {
    setPartia(nowaPartiaDla(konf.tryb, mecz.zaczyna));
    setHistoria([]);
    setMysli(false);
    setPodpowiedz(null);
    zapisane.current = null;
  };

  const cofnij = useCallback(() => {
    setHistoria(h => {
      if (h.length === 0) return h;
      // Przy grze z AI cofamy dwa półruchy, żeby wrócić do własnej kolei.
      const ile = zAI && h.length >= 2 && !koniec ? 2 : 1;
      setPartia(h[h.length - ile]);
      setMysli(false);
      setPodpowiedz(null);
      zapisane.current = null;
      return h.slice(0, h.length - ile);
    });
  }, [zAI, koniec]);

  const zagraj = (pole: number, mala?: number) => {
    if (koniec || mysli) return;
    if (zAI && partia.naRuchu !== czlowiek) return;
    const po = wykonaj(partia, konf.tryb, pole, mala);
    if (!po) return;
    setHistoria(h => [...h, partia].slice(-60));
    setPartia(po);
    setPodpowiedz(null);
    zadrgaj(12);
  };

  const pokazPodpowiedz = () => {
    if (koniec || mysli) return;
    const r = ruchKomputera(partia, konf.tryb, partia.naRuchu, 'mistrz');
    if (!r) return;
    // Czwórki: podświetlamy pole, na które faktycznie spadnie krążek
    const pole = zasady.grawitacja ? (poleWKolumnie(partia.plansza, zasady, r.pole % zasady.bok) ?? r.pole) : r.pole;
    setPodpowiedz({ pole, mala: r.mala });
    setPodpowiedzi(n => n + 1);
  };

  // Ruch komputera, z krótką pauzą — bez niej AI odpowiada w tej samej
  // klatce i wygląda to jak błąd, a nie jak ruch.
  useEffect(() => {
    if (ekran !== 'gra' || !zAI || koniec) return;
    if (partia.naRuchu === czlowiek) return;
    setMysli(true);
    const t = setTimeout(() => {
      const r = ruchKomputera(partia, konf.tryb, partia.naRuchu, konf.poziom);
      const po = r ? wykonaj(partia, konf.tryb, r.pole, r.mala) : null;
      if (po) setPartia(po);
      setMysli(false);
    }, 320);
    return () => clearTimeout(t);
  }, [ekran, zAI, koniec, partia, czlowiek, konf.tryb, konf.poziom]);

  /* ────────────────────────────── menu ────────────────────────────── */

  if (ekran === 'menu') {
    const przycisk = (aktywny: boolean, kolor = 'amber') => [
      'min-h-[44px] rounded-xl border px-2 text-sm font-semibold transition-colors',
      aktywny
        ? kolor === 'sky' ? 'border-sky-400/70 bg-sky-500/10 text-white' : 'border-amber-400/70 bg-amber-500/10 text-white'
        : 'border-slate-700/60 bg-slate-800/40 text-slate-300 active:bg-slate-700/50',
    ].join(' ');

    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-4 px-4 pt-[max(1.25rem,var(--sa-top))]">
        <header className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Kółko <span className="text-amber-400">&</span> Krzyżyk
          </h1>
          <p className="mt-1 text-sm text-slate-400">Siedem trybów · kampania · odznaki</p>
        </header>

        <nav className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-900/60 p-1">
          {([['szybka', 'Szybka gra'], ['kampania', 'Kampania'], ['odznaki', 'Odznaki']] as [Zakladka, string][]).map(([z, n]) => (
            <button
              key={z}
              type="button"
              onClick={() => setZakladka(z)}
              className={['min-h-[40px] rounded-xl text-sm font-bold', zakladka === z ? 'bg-amber-500 text-slate-950' : 'text-slate-300'].join(' ')}
            >
              {n}
            </button>
          ))}
        </nav>

        {zakladka === 'szybka' && (
          <>
            <section>
              <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-slate-500">Tryb gry</h2>
              <div className="grid grid-cols-2 gap-2">
                {WSZYSTKIE_TRYBY.map(t => (
                  <button key={t} type="button" onClick={() => setTryb(t)}
                    className={['min-h-[44px] rounded-2xl border px-3 py-2 text-left transition-colors',
                      t === tryb ? 'border-amber-400/70 bg-amber-500/10' : 'border-slate-700/60 bg-slate-800/40 active:bg-slate-700/50'].join(' ')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{NAZWY_TRYBOW[t]}</span>
                      {t === tryb && <span className="text-amber-400">✓</span>}
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-2 px-1 text-sm leading-snug text-slate-400">{OPISY_TRYBOW[tryb]}</p>
            </section>

            <section>
              <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-slate-500">Przeciwnik</h2>
              <div className="grid grid-cols-2 gap-2">
                {([['ai', 'Komputer'], ['czlowiek', 'Dwie osoby']] as [Przeciwnik, string][]).map(([w, e]) => (
                  <button key={w} type="button" onClick={() => setRywal(w)} className={przycisk(w === rywal)}>{e}</button>
                ))}
              </div>
              {rywal === 'ai' && (
                <>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(Object.keys(NAZWY_POZIOMOW) as Poziom[]).map(pz => (
                      <button key={pz} type="button" onClick={() => setPoziom(pz)} className={przycisk(pz === poziom, 'sky')}>
                        {NAZWY_POZIOMOW[pz]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 px-1 text-xs leading-snug text-slate-500">{OPISY_POZIOMOW[poziom]}</p>
                </>
              )}
            </section>

            <section className="grid grid-cols-2 gap-3">
              {rywal === 'ai' && (
                <div>
                  <h2 className="mb-1.5 px-1 text-xs font-bold uppercase tracking-widest text-slate-500">Grasz jako</h2>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['X', 'O'] as Znak[]).map(z => (
                      <button key={z} type="button" onClick={() => setZnakGracza(z)} className={przycisk(z === znakGracza)}>
                        <span className={z === 'X' ? 'text-amber-300' : 'text-sky-300'}>{z}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className={rywal === 'ai' ? '' : 'col-span-2'}>
                <h2 className="mb-1.5 px-1 text-xs font-bold uppercase tracking-widest text-slate-500">Mecz do</h2>
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 3, 5].map(n => (
                    <button key={n} type="button" onClick={() => setDoWygranych(n)} className={przycisk(n === doWygranych)}>{n}</button>
                  ))}
                </div>
              </div>
            </section>

            {/* przyklejony do dołu — opcji przybyło i bez tego „Graj” uciekał pod ekran */}
            <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-[#0b1120] via-[#0b1120] to-transparent pb-[max(1rem,var(--sa-bottom))] pt-3">
              <button
                type="button"
                onClick={() => startuj({ tryb, rywal, poziom, znakGracza, doWygranych, etap: null })}
                className="min-h-[56px] w-full rounded-2xl bg-amber-500 text-lg font-black text-slate-950 shadow-lg shadow-amber-900/30 active:scale-[0.98]"
              >
                Graj
              </button>
            </div>
          </>
        )}

        {zakladka === 'kampania' && (
          <section className="flex flex-col gap-2 pb-[max(1rem,var(--sa-bottom))]">
            <p className="px-1 text-sm text-slate-400">
              Pokonaj dziesięciu przeciwników po kolei. Każdy gra w swoim trybie i do określonej liczby wygranych.
            </p>
            {KAMPANIA.map((e, i) => {
              const pokonany = i < profil.kampania;
              const dostepny = i <= profil.kampania;
              return (
                <div key={e.imie}
                  className={['flex items-center gap-3 rounded-2xl border px-3 py-2.5',
                    pokonany ? 'border-emerald-500/40 bg-emerald-500/10' : dostepny ? 'border-amber-400/60 bg-amber-500/10' : 'border-slate-800 bg-slate-900/40 opacity-60'].join(' ')}>
                  <span className={['text-3xl', dostepny ? '' : 'grayscale'].join(' ')}>{dostepny ? e.awatar : '🔒'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{i + 1}. {e.imie}</p>
                    <p className="truncate text-xs text-slate-400">
                      {NAZWY_TRYBOW[e.tryb]} · {NAZWY_POZIOMOW[e.poziom]} · mecz do {e.doWygranych}
                    </p>
                  </div>
                  {pokonany ? (
                    <button type="button" onClick={() => startuj({ tryb: e.tryb, rywal: 'ai', poziom: e.poziom, znakGracza: 'X', doWygranych: e.doWygranych, etap: i })}
                      className="min-h-[40px] rounded-xl px-3 text-sm font-bold text-emerald-300">✓ Rewanż</button>
                  ) : dostepny ? (
                    <button type="button" onClick={() => startuj({ tryb: e.tryb, rywal: 'ai', poziom: e.poziom, znakGracza: 'X', doWygranych: e.doWygranych, etap: i })}
                      className="min-h-[40px] rounded-xl bg-amber-500 px-4 text-sm font-black text-slate-950">Graj</button>
                  ) : null}
                </div>
              );
            })}
          </section>
        )}

        {zakladka === 'odznaki' && (
          <section className="flex flex-col gap-3 pb-[max(1rem,var(--sa-bottom))]">
            <div className="grid grid-cols-4 gap-2 text-center">
              {([['Partie', profil.stat.partie], ['Wygrane', profil.stat.wygrane], ['Remisy', profil.stat.remisy], ['Seria', profil.stat.najSeria]] as [string, number][]).map(([n, v]) => (
                <div key={n} className="rounded-xl bg-slate-800/40 py-2">
                  <div className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">{n}</div>
                  <div className="text-lg font-black text-white">{v}</div>
                </div>
              ))}
            </div>
            <p className="px-1 text-xs text-slate-500">
              Odznaki: {profil.odznaki.length} / {ODZNAKI.length} · kampania: {Math.min(profil.kampania, KAMPANIA.length)} / {KAMPANIA.length}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ODZNAKI.map(o => {
                const ma = profil.odznaki.includes(o.id);
                return (
                  <div key={o.id} className={['rounded-2xl border p-3', ma ? 'border-amber-400/50 bg-amber-500/10' : 'border-slate-800 bg-slate-900/40 opacity-55'].join(' ')}>
                    <div className={['text-2xl', ma ? '' : 'grayscale'].join(' ')}>{ma ? o.ikona : '🔒'}</div>
                    <p className="mt-1 text-sm font-bold text-white">{o.nazwa}</p>
                    <p className="text-xs leading-snug text-slate-400">{o.opis}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {toast[0] && <ToastOdznaki odznaka={toast[0]} />}
      </div>
    );
  }

  /* ────────────────────────────── gra ────────────────────────────── */

  const etap = konf.etap !== null ? KAMPANIA[konf.etap] : null;
  const nazwaRywala = etap ? etap.imie : 'Komputer';
  const twojRuch = !zAI || partia.naRuchu === czlowiek;

  const komunikat = rozstrzygniecie.zwyciezca
    ? zAI
      ? rozstrzygniecie.zwyciezca === czlowiek ? 'Wygrywasz!' : `${nazwaRywala} wygrywa`
      : `Wygrywa ${rozstrzygniecie.zwyciezca}`
    : rozstrzygniecie.remis
      ? 'Remis'
      : mysli
        ? `${nazwaRywala} myśli…`
        : zAI
          ? twojRuch ? `Twój ruch (${czlowiek})` : `Ruch: ${nazwaRywala}`
          : `Ruch gracza ${partia.naRuchu}`;

  const meczowy = konf.doWygranych > 1;
  const wygranyMecz = meczRozstrzygniety && mecz.ja >= konf.doWygranych;
  const podsumowanieMeczu = !meczowy && !etap ? null
    : meczRozstrzygniety
      ? zAI
        ? wygranyMecz
          ? etap ? `${etap.awatar} ${etap.imie} — mecz wygrany! ${konf.etap! + 1 < KAMPANIA.length ? 'Następny przeciwnik odblokowany.' : 'Kampania ukończona!'}` : 'Mecz wygrany!'
          : `${nazwaRywala} wygrywa mecz`
        : `Mecz dla ${mecz.ja > mecz.on ? 'X' : 'O'}`
      : null;

  const tablica: [string, number, string][] = meczowy || etap
    ? [[zAI ? 'Ty' : 'X', mecz.ja, 'text-amber-300'], ['Remisy', mecz.remisy, 'text-slate-300'], [zAI ? nazwaRywala : 'O', mecz.on, 'text-sky-300']]
    : [['X', wynik.X, 'text-amber-300'], ['Remisy', wynik.remisy, 'text-slate-300'], ['O', wynik.O, 'text-sky-300']];

  const znika = konf.tryb === 'znikajace' && !koniec ? znikaNastepne(partia.znik, partia.naRuchu, zasady.znikanie) : null;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-3 px-3 pb-[max(0.75rem,var(--sa-bottom))] pt-[max(0.75rem,var(--sa-top))]">
      <header className="flex items-center gap-2">
        <button type="button" onClick={() => setEkran('menu')} aria-label="Wróć do menu"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800/60 text-xl text-slate-300 active:bg-slate-700">←</button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-bold text-white">
            {NAZWY_TRYBOW[konf.tryb]}{meczowy ? ` · mecz do ${konf.doWygranych}` : ''}
          </div>
          <div className="truncate text-xs text-slate-400">
            {zAI ? `${etap ? `${etap.awatar} ${etap.imie}` : 'Komputer'} · ${NAZWY_POZIOMOW[konf.poziom]}` : 'Dwie osoby'}
          </div>
        </div>
        <button type="button" onClick={pokazPodpowiedz} disabled={koniec || mysli || !twojRuch} aria-label="Podpowiedź"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800/60 text-xl active:bg-slate-700 disabled:opacity-30">💡</button>
        <button type="button" onClick={cofnij} disabled={historia.length === 0 || mysli} aria-label="Cofnij ruch"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800/60 text-xl text-slate-300 active:bg-slate-700 disabled:opacity-30">↩</button>
      </header>

      <div className="grid grid-cols-3 gap-2 text-center">
        {tablica.map(([etykieta, ile, kolor]) => (
          <div key={etykieta} className="rounded-xl bg-slate-800/40 py-2">
            <div className="truncate px-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">{etykieta}</div>
            <div className={`text-xl font-black ${kolor}`}>{ile}</div>
          </div>
        ))}
      </div>

      {etap && partia.polRuchow === 0 && !koniec && mecz.ja + mecz.on + mecz.remisy === 0 && (
        <p className="text-center text-sm italic text-slate-400">{etap.awatar} „{etap.zaczepka}”</p>
      )}

      <div aria-live="polite"
        className={['rounded-xl py-2 text-center text-base font-bold', koniec ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-300'].join(' ')}>
        {komunikat}
        {podsumowanieMeczu && <div className="mt-0.5 text-sm text-amber-200">{podsumowanieMeczu}</div>}
      </div>

      <div className="flex flex-1 items-center justify-center">
        {konf.tryb === 'ultimate' ? (
          <div className="grid w-full gap-1.5 rounded-2xl bg-slate-900/60 p-1.5" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {partia.ultimate.male.map((mala, p) => {
              const zdobyta = partia.ultimate.wyniki[p];
              const dostepna = !koniec && planszaDostepna(partia.ultimate, p);
              return (
                <div key={p} className={['relative rounded-xl p-1 transition-colors', dostepna ? 'bg-amber-500/15 ring-2 ring-amber-400/60' : 'bg-slate-800/30'].join(' ')}>
                  <Plansza pola={mala} bok={3} mini zablokowana={!dostepna || mysli || !twojRuch}
                    podpowiedz={podpowiedz?.mala === p ? podpowiedz.pole : null} onPole={i => zagraj(i, p)} />
                  {zdobyta && (
                    <div className={['absolute inset-0 flex items-center justify-center rounded-xl text-5xl font-black backdrop-blur-[2px]',
                      zdobyta === 'remis' ? 'bg-slate-900/80 text-slate-500' : zdobyta === 'X' ? 'bg-amber-950/70 text-amber-300' : 'bg-sky-950/70 text-sky-300'].join(' ')}>
                      {zdobyta === 'remis' ? '–' : zdobyta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Plansza
            pola={konf.tryb === 'znikajace' ? partia.znik.plansza : partia.plansza}
            bok={zasady.bok}
            linia={rozstrzygniecie.linia}
            ostatnie={partia.ostatnie}
            podpowiedz={podpowiedz?.pole ?? null}
            znika={znika}
            krazki={zasady.grawitacja}
            gesta={zasady.bok >= 8}
            zablokowana={koniec || mysli || !twojRuch}
            onPole={i => zagraj(i)}
          />
        )}
      </div>

      {konf.tryb === 'ultimate' && !koniec && (
        <p className="text-center text-xs leading-snug text-slate-500">
          {partia.ultimate.aktywna === null ? 'Zagraj na dowolnej podświetlonej planszy' : 'Grasz na podświetlonej planszy — wyznaczył ją poprzedni ruch'}
        </p>
      )}
      {konf.tryb === 'znikajace' && !koniec && znika !== null && (
        <p className="text-center text-xs text-slate-500">Wyszarzony znak zniknie przy następnym ruchu</p>
      )}

      {koniec ? (
        <div className="flex gap-2">
          {etap && meczRozstrzygniety && wygranyMecz && konf.etap! + 1 < KAMPANIA.length && (
            <button type="button"
              onClick={() => { const n = konf.etap! + 1; const e = KAMPANIA[n]; startuj({ tryb: e.tryb, rywal: 'ai', poziom: e.poziom, znakGracza: 'X', doWygranych: e.doWygranych, etap: n }); }}
              className="min-h-[52px] flex-1 rounded-2xl bg-amber-500 text-base font-black text-slate-950 active:scale-[0.98]">
              Dalej: {KAMPANIA[konf.etap! + 1].awatar}
            </button>
          )}
          <button type="button" onClick={nastepnaPartia}
            className="min-h-[52px] flex-1 rounded-2xl bg-slate-100 text-base font-black text-slate-900 active:scale-[0.98]">
            {meczRozstrzygniety ? (etap && !wygranyMecz ? 'Spróbuj ponownie' : 'Nowy mecz') : meczowy || etap ? 'Następna partia' : 'Jeszcze raz'}
          </button>
        </div>
      ) : (
        <button type="button" onClick={odNowa}
          className="min-h-[52px] rounded-2xl bg-slate-100 text-base font-black text-slate-900 active:scale-[0.98]">
          Od nowa
        </button>
      )}

      {toast[0] && <ToastOdznaki odznaka={toast[0]} />}
    </div>
  );
}

function ToastOdznaki({ odznaka }: { odznaka: Odznaka }) {
  return (
    <div className="fixed left-1/2 top-[max(1rem,var(--sa-top))] z-50 w-[92%] max-w-sm -translate-x-1/2 rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 shadow-2xl">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{odznaka.ikona}</span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-950/70">Nowa odznaka</p>
          <p className="truncate text-sm font-black text-amber-950">{odznaka.nazwa}</p>
          <p className="truncate text-xs text-amber-900">{odznaka.opis}</p>
        </div>
      </div>
    </div>
  );
}
