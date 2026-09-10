import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Pole,
  Znak,
  ZASADY,
  linie,
  oceń,
  pustaPlansza,
  pustyUltimate,
  ruchUltimate,
  planszaDostepna,
  megaPlansza,
  oceńUltimate,
} from './logika';
import { ruchAI } from './ai';

const p = (s: string): Pole[] =>
  s.replace(/\s/g, '').split('').map((c) => (c === '.' ? null : (c as Znak)));

test('3×3 ma 8 linii, 5×5 przy czterech w rzędzie ma 28', () => {
  assert.equal(linie(3, 3).length, 8);
  assert.equal(linie(5, 4).length, 28);
});

test('wykrywa wygraną w rzędzie, kolumnie i po przekątnej', () => {
  assert.equal(oceń(p('XXX......'), ZASADY.klasyk).zwyciezca, 'X');
  assert.equal(oceń(p('O..O..O..'), ZASADY.klasyk).zwyciezca, 'O');
  assert.equal(oceń(p('X...X...X'), ZASADY.klasyk).zwyciezca, 'X');
  assert.equal(oceń(p('..X.X.X..'), ZASADY.klasyk).zwyciezca, 'X');
});

test('zwraca pola zwycięskiej linii do podświetlenia', () => {
  assert.deepEqual(oceń(p('XXX......'), ZASADY.klasyk).linia, [0, 1, 2]);
});

test('pełna plansza bez rzędu to remis', () => {
  const r = oceń(p('XXOOOXXXO'), ZASADY.klasyk);
  assert.equal(r.zwyciezca, null);
  assert.equal(r.remis, true);
});

test('misère odwraca wynik — kto ułoży rząd, ten przegrywa', () => {
  assert.equal(oceń(p('XXX......'), ZASADY.misere).zwyciezca, 'O');
  assert.equal(oceń(p('OOO......'), ZASADY.misere).zwyciezca, 'X');
});

test('5×5 wymaga czterech w rzędzie, trzy nie wystarczą', () => {
  const trzy = pustaPlansza(5);
  [0, 1, 2].forEach((i) => (trzy[i] = 'X'));
  assert.equal(oceń(trzy, ZASADY.piec).zwyciezca, null);
  trzy[3] = 'X';
  assert.equal(oceń(trzy, ZASADY.piec).zwyciezca, 'X');
});

test('Ultimate: ruch odsyła przeciwnika na planszę o numerze zagranego pola', () => {
  const s = pustyUltimate();
  const po = ruchUltimate(s, 4, 2, 'X');
  assert.ok(po);
  assert.equal(po!.aktywna, 2);
  assert.equal(planszaDostepna(po!, 2), true);
  assert.equal(planszaDostepna(po!, 5), false);
});

test('Ultimate: gdy wskazana plansza jest rozstrzygnięta, gra się gdziekolwiek', () => {
  let s = pustyUltimate();
  // X zabiera planszę 0
  s = ruchUltimate(s, 0, 0, 'X')!;
  s = { ...s, aktywna: 0 };
  s = ruchUltimate(s, 0, 1, 'X')!;
  s = { ...s, aktywna: 0 };
  s = ruchUltimate(s, 0, 2, 'X')!;
  assert.equal(s.wyniki[0], 'X');

  // teraz ruch kierujący na planszę 0 musi dać wolny wybór
  const po = ruchUltimate({ ...s, aktywna: 4 }, 4, 0, 'O');
  assert.ok(po);
  assert.equal(po!.aktywna, null);
});

test('Ultimate: nie można zagrać poza wskazaną planszą ani na zajętym polu', () => {
  const s = ruchUltimate(pustyUltimate(), 4, 2, 'X')!;
  assert.equal(ruchUltimate(s, 5, 0, 'O'), null, 'zła plansza');
  assert.equal(ruchUltimate(s, 2, 0, 'O') !== null, true, 'wskazana plansza działa');
  const s2 = ruchUltimate(s, 2, 0, 'O')!;
  assert.equal(ruchUltimate({ ...s2, aktywna: 2 }, 2, 0, 'X'), null, 'pole zajęte');
});

test('Ultimate: mega-plansza rozstrzyga całą partię', () => {
  const s = pustyUltimate();
  s.wyniki = ['X', 'X', 'X', null, null, null, null, null, null];
  assert.deepEqual(megaPlansza(s), p('XXX......'));
  assert.equal(oceńUltimate(s).zwyciezca, 'X');
});

test('AI blokuje wygraną przeciwnika zamiast grać gdziekolwiek', () => {
  // O grozi górnym rzędem (1,2 zajęte), X musi wejść na 0.
  // Pozycja dobrana tak, by blokada faktycznie ratowała partię — w
  // 'OO.X.....' X przegrywa po każdym ruchu, więc taki test niczego nie mierzy.
  const plansza = p('.OOX....X');
  assert.equal(ruchAI(plansza, ZASADY.klasyk, 'X', 'mistrz'), 0);
});

test('w przegranej pozycji AI broni się najdłużej, zamiast szybko przegrać', () => {
  // Tu każdy ruch X przegrywa, ale 2 odwleka porażkę najdłużej —
  // 4 pozwala O wygrać już następnym ruchem.
  const plansza = p('OO.X.....');
  const r = ruchAI(plansza, ZASADY.klasyk, 'X', 'mistrz');
  assert.equal(r, 2);
});

test('AI wybiera własną wygraną, gdy jest dostępna', () => {
  const plansza = p('XX.OO....');
  assert.equal(ruchAI(plansza, ZASADY.klasyk, 'X', 'mistrz'), 2);
});

test('mistrz na 3×3 jest nie do pokonania — 40 partii bez porażki', () => {
  for (let partia = 0; partia < 40; partia++) {
    const plansza = pustaPlansza(3);
    let naRuchu: Znak = 'X'; // człowiek gra losowo
    while (true) {
      const stan = oceń(plansza, ZASADY.klasyk);
      if (stan.zwyciezca || stan.remis) {
        assert.notEqual(stan.zwyciezca, 'X', 'gracz losowy nie może wygrać z mistrzem');
        break;
      }
      if (naRuchu === 'X') {
        const wolne = plansza.reduce<number[]>((a, c, i) => (c === null ? (a.push(i), a) : a), []);
        plansza[wolne[Math.floor(Math.random() * wolne.length)]] = 'X';
      } else {
        const i = ruchAI(plansza, ZASADY.klasyk, 'O', 'mistrz');
        assert.notEqual(i, null);
        plansza[i!] = 'O';
      }
      naRuchu = naRuchu === 'X' ? 'O' : 'X';
    }
  }
});

test('AI nigdy nie zwraca zajętego pola', () => {
  const plansza = p('XOXOXO...');
  for (const poziom of ['latwy', 'sredni', 'mistrz'] as const) {
    for (let i = 0; i < 30; i++) {
      const r = ruchAI([...plansza], ZASADY.klasyk, 'X', poziom);
      assert.ok(r !== null && plansza[r] === null, `poziom ${poziom} wskazał zajęte pole`);
    }
  }
});
