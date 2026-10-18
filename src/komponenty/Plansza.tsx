import { Pole, Znak } from '../gra/logika';

interface Props {
  pola: Pole[];
  /** Liczba kolumn. */
  bok: number;
  /** Pola tworzące zwycięski rząd — podświetlane. */
  linia?: number[] | null;
  /** Ostatnio zagrane pole — krótki błysk, żeby było widać ruch AI. */
  ostatnie?: number | null;
  zablokowana?: boolean;
  onPole: (i: number) => void;
  /** Mniejsza plansza w trybie Ultimate — inne rozmiary czcionek. */
  mini?: boolean;
  /** Pole wskazane przez podpowiedź. */
  podpowiedz?: number | null;
  /** Znikające: pole, które zniknie przy następnym ruchu — wyszarzone. */
  znika?: number | null;
  /** Czwórki: okrągłe krążki zamiast liter, cała kolumna klikalna. */
  krazki?: boolean;
  /** Gęsta plansza (10×10) — mniejsze znaki i odstępy. */
  gesta?: boolean;
}

const KOLOR: Record<Znak, string> = {
  X: 'text-amber-300',
  O: 'text-sky-300',
};
const KRAZEK: Record<Znak, string> = {
  X: 'bg-amber-400 shadow-[inset_0_-4px_0_rgba(0,0,0,0.25)]',
  O: 'bg-sky-400 shadow-[inset_0_-4px_0_rgba(0,0,0,0.25)]',
};

export default function Plansza({
  pola, bok, linia, ostatnie, zablokowana, onPole, mini, podpowiedz, znika, krazki, gesta,
}: Props) {
  const rozmiar = mini
    ? 'text-[clamp(0.7rem,3.6vw,1.35rem)]'
    : gesta
      ? 'text-[clamp(0.85rem,4.4vw,1.5rem)]'
      : bok >= 5
        ? 'text-[clamp(1.2rem,7vw,2.6rem)]'
        : 'text-[clamp(1.6rem,11vw,3.8rem)]';
  return (
    <div
      className={['grid w-full select-none', krazki ? 'rounded-2xl bg-indigo-900/50 p-1.5' : ''].join(' ')}
      style={{
        gridTemplateColumns: `repeat(${bok}, minmax(0, 1fr))`,
        gap: mini ? 2 : gesta ? 3 : 6,
        // Bez tego przeciąganie palcem po planszy przewija stronę.
        touchAction: 'manipulation',
      }}
    >
      {pola.map((p, i) => {
        const wLinii = linia?.includes(i);
        // Czwórki: zajęte pole też przyjmuje dotknięcie — liczy się kolumna
        const wylaczone = zablokowana || (!krazki && p !== null);
        return (
          <button
            key={i}
            type="button"
            disabled={wylaczone}
            onClick={() => onPole(i)}
            aria-label={p ? `Pole ${i + 1}: ${p}` : `Pole ${i + 1}, puste`}
            className={[
              'flex aspect-square items-center justify-center font-black',
              'transition-[background-color,transform,box-shadow,opacity] duration-150',
              rozmiar,
              krazki ? 'rounded-full' : mini || gesta ? 'rounded-md' : 'rounded-lg',
              wLinii
                ? 'bg-emerald-500/30 ring-2 ring-emerald-400'
                : krazki
                  ? 'bg-slate-950/70'
                  : p
                    ? 'bg-slate-800/80'
                    : 'bg-slate-800/40 active:scale-95 active:bg-slate-700/70',
              ostatnie === i && !wLinii ? 'ring-2 ring-white/40' : '',
              podpowiedz === i ? 'ring-4 ring-emerald-300 animate-pulse' : '',
              znika === i ? 'opacity-35' : '',
              p && !krazki ? KOLOR[p] : '',
            ].join(' ')}
          >
            {krazki
              ? p && <span className={`block h-[82%] w-[82%] rounded-full ${KRAZEK[p]}`} />
              : p}
          </button>
        );
      })}
    </div>
  );
}
