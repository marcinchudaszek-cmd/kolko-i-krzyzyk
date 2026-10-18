/** Profil gracza: statystyki, odznaki i postęp kampanii. Bez Reacta, żeby
 *  reguły nagród dało się przetestować. */
import type { Tryb } from './logika';
import type { Poziom } from './ai';

export interface Statystyki {
  partie: number;
  wygrane: number;
  przegrane: number;
  remisy: number;
  seria: number;       // wygrane z komputerem z rzędu
  najSeria: number;
  tryby: Tryb[];       // tryby, w które już grano
  meczeWygrane: number;
}

export interface Profil {
  stat: Statystyki;
  odznaki: string[];
  /** Ile etapów kampanii jest pokonanych (następny do zagrania ma ten indeks). */
  kampania: number;
}

export const PUSTY_PROFIL: Profil = {
  stat: { partie: 0, wygrane: 0, przegrane: 0, remisy: 0, seria: 0, najSeria: 0, tryby: [], meczeWygrane: 0 },
  odznaki: [],
  kampania: 0,
};

const KLUCZ = 'kolko-krzyzyk-profil';

export function wczytajProfil(): Profil {
  try {
    const s = localStorage.getItem(KLUCZ);
    if (s) {
      const p = JSON.parse(s);
      return {
        stat: { ...PUSTY_PROFIL.stat, ...(p.stat ?? {}) },
        odznaki: Array.isArray(p.odznaki) ? p.odznaki : [],
        kampania: typeof p.kampania === 'number' ? p.kampania : 0,
      };
    }
  } catch { /* prywatne okno — gramy bez profilu */ }
  return { ...PUSTY_PROFIL, stat: { ...PUSTY_PROFIL.stat, tryby: [] }, odznaki: [] };
}

export function zapiszProfil(p: Profil): void {
  try { localStorage.setItem(KLUCZ, JSON.stringify(p)); } catch { /* brak zapisu nie przerywa gry */ }
}

/* ───────────────────────────── kampania ───────────────────────────── */

export interface Etap {
  imie: string;
  awatar: string;
  tryb: Tryb;
  poziom: Poziom;
  /** Mecz do tylu wygranych. */
  doWygranych: number;
  zaczepka: string;
}

export const KAMPANIA: Etap[] = [
  { imie: 'Pisklak', awatar: '🐣', tryb: 'klasyk', poziom: 'latwy', doWygranych: 2, zaczepka: 'Dopiero się uczę… chyba.' },
  { imie: 'Kotek Filutek', awatar: '🐱', tryb: 'misere', poziom: 'latwy', doWygranych: 2, zaczepka: 'Kto ułoży rząd, ten przegrywa. Miau!' },
  { imie: 'Lis Chytrus', awatar: '🦊', tryb: 'znikajace', poziom: 'sredni', doWygranych: 2, zaczepka: 'Moje znaki znikają, ale pułapki zostają.' },
  { imie: 'Żółw Mędrzec', awatar: '🐢', tryb: 'klasyk', poziom: 'sredni', doWygranych: 3, zaczepka: 'Powoli, ale bez błędów.' },
  { imie: 'Miś Uparciuch', awatar: '🐻', tryb: 'czworki', poziom: 'sredni', doWygranych: 2, zaczepka: 'Krążki spadają, a ja się nie poddaję.' },
  { imie: 'Sowa Profesor', awatar: '🦉', tryb: 'piec', poziom: 'sredni', doWygranych: 2, zaczepka: 'Cztery w rzędzie na 5×5 — to czysta geometria.' },
  { imie: 'Wilk Taktyk', awatar: '🐺', tryb: 'ultimate', poziom: 'sredni', doWygranych: 1, zaczepka: 'Każdy twój ruch to moja wskazówka.' },
  { imie: 'Lew Strateg', awatar: '🦁', tryb: 'gomoku', poziom: 'sredni', doWygranych: 2, zaczepka: 'Pięć w rzędzie. Zobaczymy, kto pierwszy.' },
  { imie: 'Smok Czwórek', awatar: '🐉', tryb: 'czworki', poziom: 'mistrz', doWygranych: 1, zaczepka: 'Liczę sześć ruchów naprzód.' },
  // Finał: mistrz Pięciu w rzędzie ocenia groźby, więc da się go złapać na
  // podwójną pułapkę. Mistrza Znikających nie pokonał w testach nawet gracz
  // liczący 11 półruchów — z nim kampanii nie dałoby się ukończyć.
  { imie: 'Król Kółek', awatar: '👑', tryb: 'gomoku', poziom: 'mistrz', doWygranych: 1, zaczepka: 'Ostatnia próba. Pięć w rzędzie — i nikt mnie jeszcze nie pokonał.' },
];

/* ───────────────────────────── odznaki ───────────────────────────── */

export interface Odznaka { id: string; ikona: string; nazwa: string; opis: string }

export const ODZNAKI: Odznaka[] = [
  { id: 'pierwsza', ikona: '🥇', nazwa: 'Pierwsza wygrana', opis: 'Pokonaj komputer pierwszy raz.' },
  { id: 'dziesiec', ikona: '🔟', nazwa: 'Dziesiątka', opis: 'Wygraj 10 partii z komputerem.' },
  { id: 'piecdziesiat', ikona: '🏅', nazwa: 'Weteran', opis: 'Wygraj 50 partii z komputerem.' },
  { id: 'seria5', ikona: '🔥', nazwa: 'Seria', opis: 'Wygraj 5 partii z komputerem z rzędu.' },
  { id: 'remis-mistrz', ikona: '🤝', nazwa: 'Mur', opis: 'Zremisuj z mistrzem w klasyku.' },
  { id: 'mistrz', ikona: '🧠', nazwa: 'Pogromca mistrza', opis: 'Pokonaj komputer na poziomie mistrz.' },
  { id: 'mecz5', ikona: '🏆', nazwa: 'Mecz do pięciu', opis: 'Wygraj mecz do 5 wygranych.' },
  { id: 'wszystkie', ikona: '🎲', nazwa: 'Wszechstronny', opis: 'Zagraj w każdy z 7 trybów.' },
  { id: 'bez-podpowiedzi', ikona: '🎯', nazwa: 'Bez ściągi', opis: 'Wygraj z mistrzem bez podpowiedzi.' },
  { id: 'czworki', ikona: '🔴', nazwa: 'Czwórki', opis: 'Wygraj w Czwórkach z komputerem.' },
  { id: 'gomoku', ikona: '5️⃣', nazwa: 'Piątka', opis: 'Wygraj Pięć w rzędzie z komputerem.' },
  { id: 'kampania', ikona: '👑', nazwa: 'Król kółek', opis: 'Ukończ całą kampanię.' },
];

export const WSZYSTKIE_TRYBY: Tryb[] = ['klasyk', 'piec', 'misere', 'ultimate', 'znikajace', 'gomoku', 'czworki'];

export interface KoniecPartii {
  tryb: Tryb;
  /** null przy grze we dwoje */
  przeciwnikAI: Poziom | null;
  wynik: 'wygrana' | 'przegrana' | 'remis';
  podpowiedzi: number;
}

/** Dopisuje partię do statystyk i zwraca nowo zdobyte odznaki. */
export function poPartii(p: Profil, k: KoniecPartii): { profil: Profil; nowe: Odznaka[] } {
  const s = { ...p.stat, tryby: p.stat.tryby.includes(k.tryb) ? p.stat.tryby : [...p.stat.tryby, k.tryb] };
  s.partie++;
  if (k.przeciwnikAI) {
    if (k.wynik === 'wygrana') { s.wygrane++; s.seria++; s.najSeria = Math.max(s.najSeria, s.seria); }
    else if (k.wynik === 'przegrana') { s.przegrane++; s.seria = 0; }
    else s.remisy++;
  }
  const zdobyte = new Set(p.odznaki);
  const dodaj = (id: string, warunek: boolean) => { if (warunek) zdobyte.add(id); };
  const ai = k.przeciwnikAI;
  const wygr = ai !== null && k.wynik === 'wygrana';
  dodaj('pierwsza', s.wygrane >= 1);
  dodaj('dziesiec', s.wygrane >= 10);
  dodaj('piecdziesiat', s.wygrane >= 50);
  dodaj('seria5', s.najSeria >= 5);
  dodaj('remis-mistrz', ai === 'mistrz' && k.tryb === 'klasyk' && k.wynik === 'remis');
  dodaj('mistrz', wygr && ai === 'mistrz');
  dodaj('bez-podpowiedzi', wygr && ai === 'mistrz' && k.podpowiedzi === 0);
  dodaj('czworki', wygr && k.tryb === 'czworki');
  dodaj('gomoku', wygr && k.tryb === 'gomoku');
  dodaj('wszystkie', WSZYSTKIE_TRYBY.every(t => s.tryby.includes(t)));
  return podsumuj(p, { ...p, stat: s, odznaki: [...zdobyte] });
}

/** Wygrany mecz (np. do 5) i postęp kampanii. */
export function poMeczu(p: Profil, doWygranych: number, wygrany: boolean, etapKampanii: number | null): { profil: Profil; nowe: Odznaka[] } {
  if (!wygrany) return { profil: p, nowe: [] };
  const zdobyte = new Set(p.odznaki);
  if (doWygranych >= 5) zdobyte.add('mecz5');
  let kampania = p.kampania;
  if (etapKampanii !== null && etapKampanii === p.kampania) kampania = p.kampania + 1;
  if (kampania >= KAMPANIA.length) zdobyte.add('kampania');
  return podsumuj(p, { ...p, kampania, stat: { ...p.stat, meczeWygrane: p.stat.meczeWygrane + 1 }, odznaki: [...zdobyte] });
}

function podsumuj(stary: Profil, nowy: Profil): { profil: Profil; nowe: Odznaka[] } {
  const nowe = ODZNAKI.filter(o => nowy.odznaki.includes(o.id) && !stary.odznaki.includes(o.id));
  return { profil: nowy, nowe };
}
