import { Pole, Znak } from '../gra/logika';

interface Props {
  pola: Pole[];
  bok: number;
  /** Pola tworzące zwycięski rząd — podświetlane. */
  linia?: number[] | null;
  /** Ostatnio zagrane pole — krótki błysk, żeby było widać ruch AI. */
  ostatnie?: number | null;
  zablokowana?: boolean;
  onPole: (i: number) => void;
  /** Mniejsza plansza w trybie Ultimate — inne rozmiary czcionek. */
  mini?: boolean;
}

const KOLOR: Record<Znak, string> = {
  X: 'text-amber-300',
  O: 'text-sky-300',
};

export default function Plansza({
  pola,
  bok,
  linia,
  ostatnie,
  zablokowana,
  onPole,
  mini,
}: Props) {
  return (
    <div
      className="grid w-full select-none"
      style={{
        gridTemplateColumns: `repeat(${bok}, minmax(0, 1fr))`,
        gap: mini ? 2 : 6,
        // Bez tego przeciąganie palcem po planszy przewija stronę.
        touchAction: 'manipulation',
      }}
    >
      {pola.map((p, i) => {
        const wLinii = linia?.includes(i);
        return (
          <button
            key={i}
            type="button"
            disabled={zablokowana || p !== null}
            onClick={() => onPole(i)}
            aria-label={p ? `Pole ${i + 1}: ${p}` : `Pole ${i + 1}, puste`}
            className={[
              'flex aspect-square items-center justify-center rounded-lg font-black',
              'transition-[background-color,transform,box-shadow] duration-150',
              mini ? 'text-[clamp(0.7rem,3.6vw,1.35rem)]' : 'text-[clamp(1.6rem,11vw,3.8rem)]',
              mini ? 'rounded-md' : '',
              wLinii
                ? 'bg-emerald-500/30 ring-2 ring-emerald-400'
                : p
                  ? 'bg-slate-800/80'
                  : 'bg-slate-800/40 active:scale-95 active:bg-slate-700/70',
              ostatnie === i && !wLinii ? 'ring-2 ring-white/25' : '',
              p ? KOLOR[p] : '',
            ].join(' ')}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
