import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Pole, Znak, ZASADY, linieDla, oceń, pustaDla, dozwolone, poleWKolumnie,
  pustyZnikajace, ruchZnikajacy, znikaNastepne,
} from './logika';
import { ruchAI, ruchAIZnikajace } from './ai';

const C = ZASADY.czworki;
const G = ZASADY.gomoku;

/** Plansza z napisu, wiersz po wierszu; „.” to puste pole. */
const p = (s: string): Pole[] => s.replace(/\s/g, '').split('').map(c => (c === '.' ? null : (c as Znak)));

test('Czwórki: plansza 7×6 ma 69 linii, zaczyna od dolnego rzędu', () => {
  assert.equal(linieDla(C).length, 69);
  const pusta = pustaDla(C);
  assert.equal(pusta.length, 42);
  assert.deepEqual(dozwolone(pusta, C), [35, 36, 37, 38, 39, 40, 41]);
});

test('Czwórki: krążek spada na najniższe wolne pole, pełna kolumna znika z ruchów', () => {
  const b = pustaDla(C);
  for (let k = 0; k < 6; k++) b[poleWKolumnie(b, C, 3)!] = k % 2 ? 'O' : 'X';
  assert.equal(poleWKolumnie(b, C, 3), null);
  assert.equal(dozwolone(b, C).length, 6);
  assert.equal(b[38], 'X'); // dół kolumny 3
});

test('Czwórki: wygrana pionowo i na ukos', () => {
  const pion = pustaDla(C);
  for (let k = 0; k < 4; k++) pion[poleWKolumnie(pion, C, 0)!] = 'O';
  assert.equal(oceń(pion, C).zwyciezca, 'O');
  const ukos = p(`
    .......
    .......
    ...X...
    ..XO...
    .XOO...
    XOOO...`);
  assert.equal(oceń(ukos, C).zwyciezca, 'X');
});

test('Czwórki: mistrz domyka wygraną i blokuje groźbę, w rozsądnym czasie', () => {
  const wygrana = p(`
    .......
    .......
    .......
    .......
    OO.....
    XXX....`);
  assert.equal(ruchAI(wygrana, C, 'X', 'mistrz'), 38);
  const blok = p(`
    .......
    .......
    .......
    .......
    X......
    OOO.X..`);
  assert.equal(ruchAI(blok, C, 'X', 'mistrz'), 38);
  const t0 = Date.now();
  ruchAI(pustaDla(C), C, 'X', 'mistrz');
  assert.ok(Date.now() - t0 < 3000, `pierwszy ruch mistrza trwał ${Date.now() - t0} ms`);
});

test('Pięć w rzędzie: AI kończy piątkę i blokuje otwartą czwórkę', () => {
  const b = pustaDla(G);
  [42, 43, 44, 45].forEach(i => { b[i] = 'X'; });
  [52, 53].forEach(i => { b[i] = 'O'; });
  const r = ruchAI(b, G, 'X', 'mistrz');
  assert.ok(r === 41 || r === 46, `oczekiwano 41 albo 46, jest ${r}`);
  const c = pustaDla(G);
  [22, 23, 24, 25].forEach(i => { c[i] = 'O'; });
  c[55] = 'X';
  const blok = ruchAI(c, G, 'X', 'mistrz');
  assert.ok(blok === 21 || blok === 26, `oczekiwano blokady 21/26, jest ${blok}`);
});

test('Znikające: czwarty znak kasuje najstarszy, wyszarzone jest właściwe pole', () => {
  let s = pustyZnikajace();
  for (const [pole, z] of [[0, 'X'], [4, 'O'], [1, 'X'], [5, 'O'], [8, 'X']] as [number, Znak][]) s = ruchZnikajacy(s, pole, z)!;
  assert.equal(znikaNastepne(s, 'X'), 0);
  assert.equal(znikaNastepne(s, 'O'), null);
  s = ruchZnikajacy(s, 3, 'O')!; // O ma teraz 3
  s = ruchZnikajacy(s, 2, 'X')!; // X: 0 znika, stawia 2 → 1,8,2
  assert.equal(s.plansza[0], null);
  assert.deepEqual(s.kolejki.X, [1, 8, 2]);
  assert.equal(ruchZnikajacy(s, 4, 'X'), null); // pole zajęte
});

test('Znikające: rząd wygrywa, mistrz go domyka', () => {
  let s = pustyZnikajace();
  for (const [pole, z] of [[0, 'X'], [4, 'O'], [1, 'X'], [8, 'O']] as [number, Znak][]) s = ruchZnikajacy(s, pole, z)!;
  assert.equal(ruchAIZnikajace(s, 'X', 'mistrz'), 2);
  const po = ruchZnikajacy(s, 2, 'X')!;
  assert.equal(oceń(po.plansza, ZASADY.znikajace).zwyciezca, 'X');
});
