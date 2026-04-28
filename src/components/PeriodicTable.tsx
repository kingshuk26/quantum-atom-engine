import React from 'react';

interface PeriodicTableProps {
  selectedZ: number;
  onSelect: (Z: number) => void;
}

interface ElementInfo {
  Z: number;
  symbol: string;
  name: string;
  row: number;
  col: number;
  group: 's' | 'p' | 'd' | 'f' | 'noble';
}

const ELEMENTS: ElementInfo[] = [
  { Z: 1,  symbol: 'H',  name: 'Hydrogen',   row: 1, col: 1,  group: 's' },
  { Z: 2,  symbol: 'He', name: 'Helium',      row: 1, col: 18, group: 'noble' },
  { Z: 3,  symbol: 'Li', name: 'Lithium',     row: 2, col: 1,  group: 's' },
  { Z: 4,  symbol: 'Be', name: 'Beryllium',   row: 2, col: 2,  group: 's' },
  { Z: 5,  symbol: 'B',  name: 'Boron',       row: 2, col: 13, group: 'p' },
  { Z: 6,  symbol: 'C',  name: 'Carbon',      row: 2, col: 14, group: 'p' },
  { Z: 7,  symbol: 'N',  name: 'Nitrogen',    row: 2, col: 15, group: 'p' },
  { Z: 8,  symbol: 'O',  name: 'Oxygen',      row: 2, col: 16, group: 'p' },
  { Z: 9,  symbol: 'F',  name: 'Fluorine',    row: 2, col: 17, group: 'p' },
  { Z: 10, symbol: 'Ne', name: 'Neon',        row: 2, col: 18, group: 'noble' },
  { Z: 11, symbol: 'Na', name: 'Sodium',      row: 3, col: 1,  group: 's' },
  { Z: 12, symbol: 'Mg', name: 'Magnesium',   row: 3, col: 2,  group: 's' },
  { Z: 13, symbol: 'Al', name: 'Aluminum',    row: 3, col: 13, group: 'p' },
  { Z: 14, symbol: 'Si', name: 'Silicon',     row: 3, col: 14, group: 'p' },
  { Z: 15, symbol: 'P',  name: 'Phosphorus',  row: 3, col: 15, group: 'p' },
  { Z: 16, symbol: 'S',  name: 'Sulfur',      row: 3, col: 16, group: 'p' },
  { Z: 17, symbol: 'Cl', name: 'Chlorine',    row: 3, col: 17, group: 'p' },
  { Z: 18, symbol: 'Ar', name: 'Argon',       row: 3, col: 18, group: 'noble' },
  { Z: 19, symbol: 'K',  name: 'Potassium',   row: 4, col: 1,  group: 's' },
  { Z: 20, symbol: 'Ca', name: 'Calcium',     row: 4, col: 2,  group: 's' },
  { Z: 21, symbol: 'Sc', name: 'Scandium',    row: 4, col: 3,  group: 'd' },
  { Z: 22, symbol: 'Ti', name: 'Titanium',    row: 4, col: 4,  group: 'd' },
  { Z: 23, symbol: 'V',  name: 'Vanadium',    row: 4, col: 5,  group: 'd' },
  { Z: 24, symbol: 'Cr', name: 'Chromium',    row: 4, col: 6,  group: 'd' },
  { Z: 25, symbol: 'Mn', name: 'Manganese',   row: 4, col: 7,  group: 'd' },
  { Z: 26, symbol: 'Fe', name: 'Iron',        row: 4, col: 8,  group: 'd' },
  { Z: 27, symbol: 'Co', name: 'Cobalt',      row: 4, col: 9,  group: 'd' },
  { Z: 28, symbol: 'Ni', name: 'Nickel',      row: 4, col: 10, group: 'd' },
  { Z: 29, symbol: 'Cu', name: 'Copper',      row: 4, col: 11, group: 'd' },
  { Z: 30, symbol: 'Zn', name: 'Zinc',        row: 4, col: 12, group: 'd' },
  { Z: 31, symbol: 'Ga', name: 'Gallium',     row: 4, col: 13, group: 'p' },
  { Z: 32, symbol: 'Ge', name: 'Germanium',   row: 4, col: 14, group: 'p' },
  { Z: 33, symbol: 'As', name: 'Arsenic',     row: 4, col: 15, group: 'p' },
  { Z: 34, symbol: 'Se', name: 'Selenium',    row: 4, col: 16, group: 'p' },
  { Z: 35, symbol: 'Br', name: 'Bromine',     row: 4, col: 17, group: 'p' },
  { Z: 36, symbol: 'Kr', name: 'Krypton',     row: 4, col: 18, group: 'noble' },
];

const GROUP_COLORS: Record<string, string> = {
  s: 'bg-blue-900/60 border-blue-700/60 hover:bg-blue-800/80 hover:border-blue-500',
  p: 'bg-emerald-900/60 border-emerald-700/60 hover:bg-emerald-800/80 hover:border-emerald-500',
  d: 'bg-amber-900/60 border-amber-700/60 hover:bg-amber-800/80 hover:border-amber-500',
  f: 'bg-pink-900/60 border-pink-700/60 hover:bg-pink-800/80 hover:border-pink-500',
  noble: 'bg-violet-900/60 border-violet-700/60 hover:bg-violet-800/80 hover:border-violet-500',
};

const GROUP_TEXT: Record<string, string> = {
  s: 'text-blue-300',
  p: 'text-emerald-300',
  d: 'text-amber-300',
  f: 'text-pink-300',
  noble: 'text-violet-300',
};

const SELECTED_COLORS: Record<string, string> = {
  s: 'bg-blue-500 border-blue-300 shadow-blue-500/60',
  p: 'bg-emerald-500 border-emerald-300 shadow-emerald-500/60',
  d: 'bg-amber-500 border-amber-300 shadow-amber-500/60',
  f: 'bg-pink-500 border-pink-300 shadow-pink-500/60',
  noble: 'bg-violet-500 border-violet-300 shadow-violet-500/60',
};

const PeriodicTable: React.FC<PeriodicTableProps> = ({ selectedZ, onSelect }) => {
  const maxCol = 18;
  const maxRow = 4;

  return (
    <div className="w-full">
      <div 
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${maxCol}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${maxRow}, minmax(0, 1fr))`,
        }}
      >
        {ELEMENTS.map(el => {
          const isSelected = el.Z === selectedZ;
          const colStart = el.col;
          const rowStart = el.row;
          
          return (
            <button
              key={el.Z}
              onClick={() => onSelect(el.Z)}
              title={`${el.name} (Z=${el.Z})`}
              style={{
                gridColumnStart: colStart,
                gridRowStart: rowStart,
              }}
              className={`
                relative border rounded text-center cursor-pointer transition-all duration-150
                ${isSelected 
                  ? `${SELECTED_COLORS[el.group]} shadow-lg scale-110 z-10` 
                  : GROUP_COLORS[el.group]
                }
                ${isSelected ? 'text-white' : GROUP_TEXT[el.group]}
              `}
            >
              <div className="flex flex-col items-center justify-center p-0.5" style={{ minHeight: '2rem' }}>
                <span className="text-[7px] leading-none opacity-60">{el.Z}</span>
                <span className={`text-[9px] font-bold leading-tight ${isSelected ? 'text-white' : ''}`}>
                  {el.symbol}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs">
        {Object.entries({ 's-block': 's', 'p-block': 'p', 'd-block': 'd', 'Noble': 'noble' }).map(([label, group]) => (
          <div key={group} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded border ${SELECTED_COLORS[group]}`} />
            <span className={GROUP_TEXT[group] + ' text-[10px]'}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PeriodicTable;
