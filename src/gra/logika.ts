/** Logika wszystkich trybów, bez Reacta — dzięki temu da się ją przetestować
 *  bez renderowania i nie rozjedzie się między trybami. */

export type Znak = 'X' | 'O';
export type Pole = Znak | null;
export type Tryb = 'klasyk' | 'piec' | 'misere' | 'ultimate';

export interface Zasady {
  bok: number;          // plansza bok × bok
  doWygranej: number;   // ile znaków w rzędzie
  /** Misère: kto ułoży rząd, ten PRZEGRYWA. */
  odwrotnie: boolean;
}

export const ZASADY: Record<Tryb, Zasady> = {
  klasyk: { bok: 3, doWygranej: 3, odwrotnie: false },
  piec: { bok: 5, doWygranej: 4, odwrotnie: false },
  misere: { bok: 3, doWygranej: 3, odwrotnie: true },
  ultimate: { bok: 3, doWygranej: 3, odwrotnie: false },
};

export const NAZWY_TRYBOW: Record<Tryb, string> = {
  klasyk: 'Klasyk',
  piec: '5×5',
  misere: 'Misère',
  ultimate: 'Ultimate',
};

export const OPISY_TRYBOW: Record<Tryb, string> = {
  klasyk: '3×3, trzy w rzędzie. Klasyka, którą zna każdy.',
  piec: 'Plansza 5×5, cztery w rzędzie. Więcej miejsca, więcej pułapek.',
  misere: '3×3 na odwrót — kto ułoży trzy w rzędzie, ten przegrywa.',
  ultimate: 'Dziewięć małych plansz. Twój ruch wyznacza planszę przeciwnika.',
};

export const pustaPlansza = (bok: number): Pole[] => Array(bok * bok).fill(null);

/** Wszystkie linie wygrywające dla planszy bok×bok przy N w rzędzie.
 *  Liczone raz na tryb i zapamiętywane — dla 5×5 to 28 linii. */
const pamiecLinii = new Map<string, number[][]>();

export function linie(bok: number, doWygranej: number): number[][] {
  const klucz = `${bok}:${doWygranej}`;
  const gotowe = pamiecLinii.get(klucz);
  if (gotowe) return gotowe;

  const wynik: number[][] = [];
  const kierunki = [
    [1, 0], // poziomo
    [0, 1], // pionowo
    [1, 1], // po przekątnej w dół
    [1, -1], // po przekątnej w górę
  ];

  for (let y = 0; y < bok; y++) {
    for (let x = 0; x < bok; x++) {
      for (const [dx, dy] of kierunki) {
        const koniecX = x + dx * (doWygranej - 1);
        const koniecY = y + dy * (doWygranej - 1);
        if (koniecX < 0 || koniecX >= bok || koniecY < 0 || koniecY >= bok) continue;
        const linia: number[] = [];
        for (let i = 0; i < doWygranej; i++) {
          linia.push((y + dy * i) * bok + (x + dx * i));
        }
        wynik.push(linia);
      }
    }
  }

  pamiecLinii.set(klucz, wynik);
  return wynik;
}

export interface Rozstrzygniecie {
  /** Kto wygrał wg zasad danego trybu (w misère to NIE jest autor rzędu). */
  zwyciezca: Znak | null;
  remis: boolean;
  /** Pola tworzące rząd — do podświetlenia. */
  linia: number[] | null;
}

export function oceń(plansza: Pole[], zasady: Zasady): Rozstrzygniecie {
  for (const l of linie(zasady.bok, zasady.doWygranej)) {
    const pierwszy = plansza[l[0]];
    if (!pierwszy) continue;
    if (l.every((i) => plansza[i] === pierwszy)) {
      // Misère: ułożenie rzędu oznacza przegraną, więc wygrywa przeciwnik.
      const zwyciezca = zasady.odwrotnie ? przeciwnik(pierwszy) : pierwszy;
      return { zwyciezca, remis: false, linia: l };
    }
  }
  const pelna = plansza.every((p) => p !== null);
  return { zwyciezca: null, remis: pelna, linia: null };
}

export const przeciwnik = (z: Znak): Znak => (z === 'X' ? 'O' : 'X');

export const wolnePola = (plansza: Pole[]): number[] =>
  plansza.reduce<number[]>((acc, p, i) => (p === null ? (acc.push(i), acc) : acc), []);

/* ────────────────────────────── Ultimate ───────────────────────────── */

export interface StanUltimate {
  /** 9 małych plansz po 9 pól. */
  male: Pole[][];
  /** Wynik każdej małej planszy: znak zwycięzcy, 'remis' albo null. */
  wyniki: (Znak | 'remis' | null)[];
  /** Indeks planszy, w której trzeba zagrać; null = dowolna. */
  aktywna: number | null;
}

export const pustyUltimate = (): StanUltimate => ({
  male: Array.from({ length: 9 }, () => pustaPlansza(3)),
  wyniki: Array(9).fill(null),
  aktywna: null,
});

/** Czy w tej małej planszy wolno teraz zagrać. */
export function planszaDostepna(stan: StanUltimate, i: number): boolean {
  if (stan.wyniki[i] !== null) return false;
  return stan.aktywna === null || stan.aktywna === i;
}

export function ruchUltimate(
  stan: StanUltimate,
  plansza: number,
  pole: number,
  znak: Znak
): StanUltimate | null {
  if (!planszaDostepna(stan, plansza)) return null;
  if (stan.male[plansza][pole] !== null) return null;

  const male = stan.male.map((p, i) => (i === plansza ? [...p] : p));
  male[plansza][pole] = znak;

  const wyniki = [...stan.wyniki];
  const ocena = oceń(male[plansza], ZASADY.klasyk);
  if (ocena.zwyciezca) wyniki[plansza] = ocena.zwyciezca;
  else if (ocena.remis) wyniki[plansza] = 'remis';

  // Ruch odsyła przeciwnika do planszy o numerze zagranego pola. Jeśli tamta
  // jest już rozstrzygnięta, przeciwnik gra gdzie chce — inaczej gra by utknęła.
  const aktywna = wyniki[pole] === null ? pole : null;

  return { male, wyniki, aktywna };
}

/** Mega-plansza widziana jako zwykłe 3×3 z wyników małych plansz. */
export const megaPlansza = (stan: StanUltimate): Pole[] =>
  stan.wyniki.map((w) => (w === 'remis' || w === null ? null : w));

export function oceńUltimate(stan: StanUltimate): Rozstrzygniecie {
  const ocena = oceń(megaPlansza(stan), ZASADY.klasyk);
  if (ocena.zwyciezca) return ocena;
  const koniec = stan.wyniki.every((w) => w !== null);
  return { zwyciezca: null, remis: koniec, linia: null };
}
