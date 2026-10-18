import assert from 'node:assert/strict';
import test from 'node:test';
import { PUSTY_PROFIL, Profil, poPartii, poMeczu, KAMPANIA, WSZYSTKIE_TRYBY } from './profil';

const swiezy = (): Profil => ({ ...PUSTY_PROFIL, stat: { ...PUSTY_PROFIL.stat, tryby: [] }, odznaki: [] });

test('pierwsza wygrana daje odznakę, seria liczy się i zeruje po porażce', () => {
  let p = swiezy();
  const r = poPartii(p, { tryb: 'klasyk', przeciwnikAI: 'latwy', wynik: 'wygrana', podpowiedzi: 0 });
  assert.deepEqual(r.nowe.map(o => o.id), ['pierwsza']);
  p = r.profil;
  for (let i = 0; i < 4; i++) p = poPartii(p, { tryb: 'klasyk', przeciwnikAI: 'latwy', wynik: 'wygrana', podpowiedzi: 0 }).profil;
  assert.equal(p.stat.seria, 5);
  assert.ok(p.odznaki.includes('seria5'));
  p = poPartii(p, { tryb: 'klasyk', przeciwnikAI: 'latwy', wynik: 'przegrana', podpowiedzi: 0 }).profil;
  assert.equal(p.stat.seria, 0);
  assert.equal(p.stat.najSeria, 5);
});

test('gra we dwoje nie liczy się do wygranych z komputerem', () => {
  const r = poPartii(swiezy(), { tryb: 'klasyk', przeciwnikAI: null, wynik: 'wygrana', podpowiedzi: 0 });
  assert.equal(r.profil.stat.wygrane, 0);
  assert.equal(r.profil.stat.partie, 1);
  assert.equal(r.nowe.length, 0);
});

test('mistrz: z podpowiedzią bez odznaki „Bez ściągi”, remis w klasyku daje „Mur”', () => {
  const z = poPartii(swiezy(), { tryb: 'czworki', przeciwnikAI: 'mistrz', wynik: 'wygrana', podpowiedzi: 2 });
  assert.ok(z.profil.odznaki.includes('mistrz'));
  assert.ok(!z.profil.odznaki.includes('bez-podpowiedzi'));
  const m = poPartii(swiezy(), { tryb: 'klasyk', przeciwnikAI: 'mistrz', wynik: 'remis', podpowiedzi: 0 });
  assert.ok(m.profil.odznaki.includes('remis-mistrz'));
});

test('wszystkie tryby, mecz do 5 i kampania krok po kroku', () => {
  let p = swiezy();
  for (const t of WSZYSTKIE_TRYBY) p = poPartii(p, { tryb: t, przeciwnikAI: null, wynik: 'remis', podpowiedzi: 0 }).profil;
  assert.ok(p.odznaki.includes('wszystkie'));
  assert.ok(poMeczu(p, 5, true, null).profil.odznaki.includes('mecz5'));
  // wygrana z etapem, który nie jest kolejnym, nie przesuwa kampanii
  assert.equal(poMeczu(p, 2, true, 3).profil.kampania, 0);
  for (let i = 0; i < KAMPANIA.length; i++) p = poMeczu(p, 1, true, i).profil;
  assert.equal(p.kampania, KAMPANIA.length);
  assert.ok(p.odznaki.includes('kampania'));
  assert.equal(poMeczu(p, 1, false, 0).profil, p); // przegrany mecz nic nie zmienia
});
