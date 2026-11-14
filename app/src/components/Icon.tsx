import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'home' | 'clock' | 'user' | 'scan' | 'search' | 'back' | 'close' | 'alert' | 'check' | 'flash' | 'chevron' | 'bolt' | 'chat' | 'send';

export function Icon({ name, size = 24, color = '#0B0B0F' }: { name: IconName; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path {...p} d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />}
      {name === 'clock' && (<><Circle {...p} cx={12} cy={12} r={9} /><Path {...p} d="M12 7v5l3 2" /></>)}
      {name === 'user' && (<><Circle {...p} cx={12} cy={8} r={4} /><Path {...p} d="M4 20c1-4 4-6 8-6s7 2 8 6" /></>)}
      {name === 'scan' && (<><Path {...p} d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><Path {...p} d="M8 9v6M12 9v6M16 9v6" /></>)}
      {name === 'search' && (<><Circle {...p} cx={11} cy={11} r={7} /><Path {...p} d="M20 20l-4-4" /></>)}
      {name === 'back' && <Path {...p} d="M15 5l-7 7 7 7" />}
      {name === 'close' && <Path {...p} d="M6 6l12 12M18 6L6 18" />}
      {name === 'alert' && (<><Path {...p} d="M12 3l10 18H2z" /><Path {...p} d="M12 10v5M12 18v.01" /></>)}
      {name === 'check' && <Path {...p} d="M5 12l5 5 9-10" />}
      {name === 'flash' && <Path {...p} d="M13 3L5 14h6l-1 7 8-11h-6z" />}
      {name === 'chevron' && <Path {...p} d="M9 5l7 7-7 7" />}
      {name === 'chat' && <Path {...p} d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" />}
      {name === 'send' && <Path {...p} d="M4 12l16-8-6 16-3-7z" />}
      {name === 'bolt' && <Rect {...p} x={5} y={5} width={14} height={14} rx={3} />}
    </Svg>
  );
}
