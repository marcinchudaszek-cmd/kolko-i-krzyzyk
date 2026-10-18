# Kółko i Krzyżyk

Kółko i krzyżyk w siedmiu trybach, z przeciwnikiem komputerowym na trzech poziomach,
meczami do 1/3/5 wygranych, kampanią (10 przeciwników) i odznakami.
Gra w przeglądarce: **https://beagleapps.pl/games/tic-tac-toe/**

## Tryby

| Tryb | Zasady |
|---|---|
| **Klasyk** | 3×3, trzy w rzędzie |
| **5×5** | plansza 5×5, cztery w rzędzie |
| **Misère** | 3×3 na odwrót — kto ułoży rząd, ten przegrywa |
| **Ultimate** | dziewięć małych plansz; zagrane pole wyznacza planszę przeciwnika |
| **Znikające** | 3×3, każdy ma najwyżej 3 znaki — czwarty kasuje najstarszy |
| **Pięć w rzędzie** | plansza 10×10, pięć w rzędzie (15×15 dawałoby za małe pola na telefonie) |
| **Czwórki** | 7×6 z grawitacją, cztery w rzędzie |

## Przeciwnik

- **Łatwy** — czasem zagra przypadkowo
- **Średni** — broni się, ale nie liczy do końca
- **Mistrz** — na 3×3 pełny minimax z odcięciami alfa-beta, nie da się wygrać

Na 5×5 pełne drzewo jest poza zasięgiem, więc działa minimax z ograniczoną
głębokością i oceną pozycji. Ultimate ma zbyt duże drzewo na minimax w
przeglądarce — tam ruch wybiera heurystyka (zdobycie małej planszy, blokada,
wartość pola na mega-planszy, kara za oddanie przeciwnikowi swobody).

## Dlaczego logika jest poza Reactem

`src/gra/logika.ts` i `src/gra/ai.ts` nie znają Reacta, dzięki czemu zasady
wszystkich trybów da się przetestować bez renderowania i nie rozjeżdżają się
między trybami.

```bash
npm install
npm test        # 26 testów: zasady trybów, AI, odznaki i kampania
npm run dev
npm run build   # dist/index.html — jeden plik, do wgrania na stronę
```

## Na telefonie

Menu i plansza mieszczą się bez przewijania na 375×812, cele dotykowe mają
co najmniej 44 px. Wyjątkiem jest Ultimate: 81 pól na szerokości 375 px daje
32 px na pole i więcej fizycznie się nie mieści — chroni nas to, że aktywna
jest zawsze tylko jedna mała plansza, a pozostałe są zablokowane.

## Kampania

Dziesięciu przeciwników w różnych trybach (`src/gra/profil.ts`). Finał to Pięć w rzędzie
na poziomie mistrz — mistrza Znikających nie pokonał w testach nawet gracz liczący
11 półruchów naprzód, więc z nim kampanii nie dałoby się ukończyć.
