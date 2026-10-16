import { StyleSheet } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { orange } from '@/theme';
import { fontFamily } from '@/theme/typography';

// Cena de RA simulada. Substitui a câmera enquanto o ViroReact não está
// integrado (exige development build — Stacks Mobile, 2.4). A tela de medição
// só conhece esta interface: pontos marcados e rótulos das arestas, então a
// troca pela `ViroARSceneNavigator` não afeta o restante do fluxo.

export interface ScenePoint {
  x: number;
  y: number;
}

interface ARMeasurementSceneProps {
  /** Vértices já marcados, em coordenadas da cena (390 × 844). */
  points: ScenePoint[];
  /** Comprimento de cada aresta, em metros. */
  edgeLengths: number[];
  closed: boolean;
}

const VIEW_W = 390;
const VIEW_H = 844;
const tileRows = Array.from({ length: 34 }, (_, i) => 300 + i * 12);

export function ARMeasurementScene({ points, edgeLengths, closed }: ARMeasurementSceneProps) {
  const edges = points.map((p, i) => [p, points[i + 1] ?? (closed ? points[0] : null)] as const).filter(
    (edge): edge is readonly [ScenePoint, ScenePoint] => edge[1] !== null,
  );

  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3E8EDB" />
          <Stop offset="1" stopColor="#BFDDF5" />
        </LinearGradient>
        <ClipPath id="roof">
          <Polygon points="-20,418 214,334 335,560 380,600 390,700 -20,700" />
        </ClipPath>
        <ClipPath id="roofRight">
          <Polygon points="250,318 390,282 390,470 330,500" />
        </ClipPath>
      </Defs>

      <Rect width={VIEW_W} height={VIEW_H} fill="url(#sky)" />
      <Path d="M0 250 Q80 222 160 240 T320 236 T390 244 V330 H0 Z" fill="#7C9A5C" />
      <Path d="M0 280 Q100 262 200 276 T390 270 V360 H0 Z" fill="#5E7F44" />
      {[40, 110, 330, 365].map((x, i) => (
        <Circle key={x} cx={x} cy={300 - (i % 2) * 14} r={26 + (i % 2) * 8} fill="#3F6B2E" />
      ))}

      {/* Parede e janelas */}
      <Rect x={0} y={560} width={VIEW_W} height={300} fill="#EDE5D8" />
      <Rect x={90} y={600} width={70} height={80} rx={3} fill="#6B4A2E" />
      <Rect x={200} y={600} width={70} height={80} rx={3} fill="#6B4A2E" />

      {/* Telhados cerâmicos */}
      <G clipPath="url(#roofRight)">
        <Rect x={240} y={270} width={160} height={240} fill="#B65A3C" />
        {tileRows.map((y) => (
          <Line key={`r${y}`} x1={240} y1={y} x2={400} y2={y - 30} stroke="#8F4128" strokeWidth={2} />
        ))}
      </G>
      <G clipPath="url(#roof)">
        <Rect x={-20} y={320} width={420} height={400} fill="#C0643F" />
        {tileRows.map((y) => (
          <Line key={`l${y}`} x1={-20} y1={y + 120} x2={400} y2={y - 20} stroke="#9A4A2D" strokeWidth={2.5} />
        ))}
      </G>
      <Path d="M214 334 L335 560" stroke="#8A3E26" strokeWidth={6} />

      {/* Polígono de medição */}
      {closed && points.length > 2 && (
        <Polygon points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill={orange[500]} fillOpacity={0.18} />
      )}
      {edges.map(([a, b], i) => (
        <G key={`e${i}`}>
          <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={orange[500]} strokeWidth={3} />
          <EdgeLabel x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} label={`${edgeLengths[i]?.toFixed(1)}m`} />
        </G>
      ))}
      {points.map((p, i) => (
        <Circle key={`p${i}`} cx={p.x} cy={p.y} r={6} fill="#FFFFFF" stroke={orange[500]} strokeWidth={2.5} />
      ))}

      {/* Retícula central */}
      <G stroke="#FFFFFF" strokeWidth={3} fill="none">
        <Path d="M137 382 V364 H155" />
        <Path d="M235 364 H253 V382" />
        <Path d="M253 460 V478 H235" />
        <Path d="M155 478 H137 V460" />
      </G>
      <Circle cx={195} cy={421} r={2.5} fill="#FFFFFF" />
    </Svg>
  );
}

function EdgeLabel({ x, y, label }: { x: number; y: number; label: string }) {
  const width = 44;
  return (
    <G>
      <Rect x={x - width / 2} y={y - 12} width={width} height={24} rx={6} fill={orange[500]} />
      <SvgText x={x} y={y + 5} fill="#FFFFFF" fontSize={13} fontFamily={fontFamily.bold} textAnchor="middle">
        {label}
      </SvgText>
    </G>
  );
}
