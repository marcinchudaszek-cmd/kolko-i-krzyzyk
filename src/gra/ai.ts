/** Przeciwnik komputerowy. Trzy poziomy, wspólne dla wszystkich trybów.
 *
 *  3×3 (klasyk, misère) jest na tyle małe, że "mistrz" liczy pełny minimax —
 *  jest nie do pokonania, remis to najlepszy możliwy wynik gracza.
 *  5×5 ma 25 pól i pełne drzewo jest poza zasięgiem, więc tam działa
 *  minimax z ograniczoną głębokością i oceną pozycji. */

import {
  Pole,
  Znak,
  Zasady,
  linie,
  oceń,
  przeciwnik,
  wolnePola,
  StanUltimate,
  planszaDostepna,
  ruchUltimate,
  megaPlansza,
  ZASADY,
} from './logika';

export type Poziom = 'latwy' | 'sredni' | 'mistrz';

export const NAZWY_POZIOMOW: Record<Poziom, string> = {
  latwy: 'Łatwy',
  sredni: 'Średni',
  mistrz: 'Mistrz',
};

export const OPISY_POZIOMOW: Record<Poziom, string> = {
  latwy: 'Czasem zagra przypadkowo. Dobry na rozgrzewkę.',
  sredni: 'Broni się i wykorzystuje błędy, ale nie liczy do końca.',
  mistrz: 'Na 3×3 nie da się wygrać — najlepsze, co możesz osiągnąć, to remis.',
};

const losowy = <T,>(t: T[]): T => t[Math.floor(Math.random() * t.length)];

/* ───────────────────────── plansza kwadratowa ───────────────────────── */

/** Ocena pozycji dla znaku `ja`: liczy linie, które wciąż są otwarte.
 *  Linia z k własnymi znakami i zerem cudzych warta jest 10^k. */
function ocenPozycje(plansza: Pole[], zasady: Zasady, ja: Znak): number {
  const on = przeciwnik(ja);
  let wynik = 0;
  for (const l of linie(zasady.bok, zasady.doWygranej)) {
    let moje = 0;
    let jego = 0;
    for (const i of l) {
      if (plansza[i] === ja) moje++;
      else if (plansza[i] === on) jego++;
    }
    if (moje > 0 && jego === 0) wynik += Math.pow(10, moje);
    else if (jego > 0 && moje === 0) wynik -= Math.pow(10, jego);
  }
  return zasady.odwrotnie ? -wynik : wynik;
}

function minimax(
  plansza: Pole[],
  zasady: Zasady,
  ja: Znak,
  naRuchu: Znak,
  glebokosc: number,
  alfa: number,
  beta: number
): number {
  const ocena = oceń(plansza, zasady);
  // `glebokosc` to pozostały zapas przeszukiwania: im większy, tym wcześniej
  // w partii jesteśmy. Wygraną chcemy mieć jak najwcześniej (premia rośnie z
  // zapasem), a przegraną odwlec jak najdłużej (kara maleje z zapasem).
  // Bez tego rozróżnienia AI w przegranej pozycji wybiera najkrótszą drogę do
  // porażki, zamiast bronić się i dać przeciwnikowi szansę na błąd.
  if (ocena.zwyciezca === ja) return 1_000_000 + glebokosc * 100;
  if (ocena.zwyciezca === przeciwnik(ja)) return -1_000_000 - glebokosc * 100;
  if (ocena.remis) return 0;
  if (glebokosc <= 0) return ocenPozycje(plansza, zasady, ja);

  const maksymalizuje = naRuchu === ja;
  let najlepszy = maksymalizuje ? -Infinity : Infinity;

  for (const i of wolnePola(plansza)) {
    plansza[i] = naRuchu;
    const w = minimax(plansza, zasady, ja, przeciwnik(naRuchu), glebokosc - 1, alfa, beta);
    plansza[i] = null;

    if (maksymalizuje) {
      najlepszy = Math.max(najlepszy, w);
      alfa = Math.max(alfa, w);
    } else {
      najlepszy = Math.min(najlepszy, w);
      beta = Math.min(beta, w);
    }
    if (beta <= alfa) break; // odcięcie alfa-beta
  }
  return najlepszy;
}

function glebokoscDla(zasady: Zasady, wolne: number, poziom: Poziom): number {
  if (poziom === 'latwy') return 1;
  if (zasady.bok === 3) return 9; // pełne drzewo, tanio
  if (poziom === 'sredni') return 3;
  // 5×5: pełne drzewo odpada, ale przy malejącej liczbie pól można głębiej
  return wolne > 16 ? 4 : wolne > 10 ? 5 : 7;
}

export function ruchAI(
  plansza: Pole[],
  zasady: Zasady,
  ja: Znak,
  poziom: Poziom
): number | null {
  const wolne = wolnePola(plansza);
  if (wolne.length === 0) return null;

  // Łatwy myli się celowo — inaczej nawet płytki minimax bywa nie do ruszenia.
  if (poziom === 'latwy' && Math.random() < 0.45) return losowy(wolne);
  if (poziom === 'sredni' && Math.random() < 0.12) return losowy(wolne);

  const kopia = [...plansza];
  const glebokosc = glebokoscDla(zasady, wolne.length, poziom);

  let najlepszaOcena = -Infinity;
  let najlepsze: number[] = [];

  for (const i of wolne) {
    kopia[i] = ja;
    const w = minimax(kopia, zasady, ja, przeciwnik(ja), glebokosc - 1, -Infinity, Infinity);
    kopia[i] = null;
    if (w > najlepszaOcena) {
      najlepszaOcena = w;
      najlepsze = [i];
    } else if (w === najlepszaOcena) {
      najlepsze.push(i);
    }
  }

  // Remis między równorzędnymi ruchami rozstrzygamy losowo, żeby AI nie grało
  // za każdym razem tej samej partii.
  return losowy(najlepsze);
}

/* ─────────────────────────────── Ultimate ──────────────────────────── */

export interface RuchUltimate {
  plansza: number;
  pole: number;
}

/** Ultimate ma zbyt duże drzewo na minimax w przeglądarce, więc oceniamy
 *  ruch heurystycznie: wygrana małej planszy, blokada przeciwnika, wartość
 *  pola na mega-planszy i kara za odesłanie przeciwnika tam, gdzie może dużo. */
export function ruchAIUltimate(
  stan: StanUltimate,
  ja: Znak,
  poziom: Poziom
): RuchUltimate | null {
  const on = przeciwnik(ja);
  const mozliwe: RuchUltimate[] = [];
  for (let p = 0; p < 9; p++) {
    if (!planszaDostepna(stan, p)) continue;
    for (let k = 0; k < 9; k++) {
      if (stan.male[p][k] === null) mozliwe.push({ plansza: p, pole: k });
    }
  }
  if (mozliwe.length === 0) return null;
  if (poziom === 'latwy' && Math.random() < 0.5) return losowy(mozliwe);

  // Środek i rogi mega-planszy są warte więcej niż boki.
  const wagaPola = [3, 2, 3, 2, 4, 2, 3, 2, 3];

  let najlepsza = -Infinity;
  let najlepsze: RuchUltimate[] = [];

  for (const ruch of mozliwe) {
    const po = ruchUltimate(stan, ruch.plansza, ruch.pole, ja);
    if (!po) continue;

    let punkty = 0;

    if (po.wyniki[ruch.plansza] === ja) {
      punkty += 40 + wagaPola[ruch.plansza] * 6;
      // Czy ta zdobycz układa rząd na mega-planszy?
      if (oceń(megaPlansza(po), ZASADY.klasyk).zwyciezca === ja) punkty += 10_000;
    }

    // Blokada: gdyby przeciwnik zagrał tutaj, wziąłby planszę
    const gdybyOn = ruchUltimate(stan, ruch.plansza, ruch.pole, on);
    if (gdybyOn && gdybyOn.wyniki[ruch.plansza] === on) punkty += 30;

    punkty += ocenPozycje(po.male[ruch.plansza], ZASADY.klasyk, ja) / 10;
    punkty += wagaPola[ruch.pole] * 0.5;

    // Kara za wysłanie przeciwnika na planszę, na której ma dużo swobody,
    // i duża kara za oddanie mu wolnego wyboru.
    if (po.aktywna === null) punkty -= 12;
    else {
      const cel = po.male[po.aktywna];
      punkty -= wolnePola(cel).length * 0.6;
      if (ocenPozycje(cel, ZASADY.klasyk, on) > 50) punkty -= 15;
    }

    if (poziom === 'sredni') punkty += (Math.random() - 0.5) * 12;

    if (punkty > najlepsza) {
      najlepsza = punkty;
      najlepsze = [ruch];
    } else if (punkty === najlepsza) {
      najlepsze.push(ruch);
    }
  }

  return losowy(najlepsze);
}
