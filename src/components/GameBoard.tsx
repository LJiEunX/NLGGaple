import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { BoardState, PlacedTile, EndSide } from '../types.ts';
import { DominoTile } from './DominoTile.tsx';
import { CangkulDeck } from './CangkulDeck.tsx';
import { ArrowLeft, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';

interface GameBoardProps {
  board: BoardState;
  onSelectEnd?: (end: EndSide) => void;
  selectableEnds?: EndSide[];
  drawPoolCount?: number;
  onDraw?: () => void;
  canDraw?: boolean;
}

interface LayoutTile {
  placed: PlacedTile;
  chainIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: 'horizontal' | 'vertical';
  visualFacing: [number, number];
  isCorner: boolean;
  cornerDir?: 'right' | 'left';
}

interface SlotPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: 'horizontal' | 'vertical';
}

/**
 * Calculates exact 2D coordinates matching the authentic Domino Snake Flow:
 * - Center Middle Row (Y = 0) with initial anchor tile.
 * - Balak (double) tiles in horizontal rows are placed CROSSWISE (vertical, centered across Y = 0).
 * - Right branch extends rightwards (+X); turns UPWARDS (-Y) when reaching M tiles, then loops LEFTWARDS (-X).
 * - Left branch extends leftwards (-X); turns DOWNWARDS (+Y) when reaching M tiles, then loops RIGHTWARDS (+X).
 * - In vertical runs, balak tiles are placed CROSSWISE (horizontal).
 * - 100% physical edge-to-edge connection with ZERO overlap.
 * - Proper pip matching on every turn (no inverted facings, e.g. 2 will never overlap 3).
 */
function computeSnakeLayout(
  chain: PlacedTile[],
  M: number,
  u: number
): {
  tiles: LayoutTile[];
  leftSlot: SlotPosition;
  rightSlot: SlotPosition;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
} {
  if (chain.length === 0) {
    return {
      tiles: [],
      leftSlot: { x: -u, y: -u / 2, w: 2 * u, h: u, orientation: 'horizontal' },
      rightSlot: { x: u, y: -u / 2, w: 2 * u, h: u, orientation: 'horizontal' },
      bounds: { minX: -2 * u, maxX: 2 * u, minY: -u, maxY: u },
    };
  }

  // 1. Locate Anchor (Initial) Tile
  let anchorIdx = chain.findIndex((t) => t.isAnchor);
  if (anchorIdx === -1) {
    anchorIdx = Math.floor(chain.length / 2);
  }

  const result: LayoutTile[] = new Array(chain.length);
  const anchor = chain[anchorIdx];
  const isAnchorBalak = anchor.isBalak;

  // Place Anchor Tile at center (0, 0)
  if (isAnchorBalak) {
    result[anchorIdx] = {
      placed: anchor,
      chainIndex: anchorIdx,
      x: -u / 2,
      y: -u,
      w: u,
      h: 2 * u,
      orientation: 'vertical',
      visualFacing: anchor.facing,
      isCorner: false,
    };
  } else {
    result[anchorIdx] = {
      placed: anchor,
      chainIndex: anchorIdx,
      x: -u,
      y: -u / 2,
      w: 2 * u,
      h: u,
      orientation: 'horizontal',
      visualFacing: anchor.facing,
      isCorner: false,
    };
  }

  // 2. Right Branch: from anchorIdx + 1 up to chain.length - 1
  // Incoming pip is facing[0], outgoing pip is facing[1].
  let rightState = {
    dir: 'right' as 'right' | 'up' | 'left',
    connX: isAnchorBalak ? u / 2 : u,
    tilesInDir: 0,
    turnRightEdgeX: 0,
    topRowY: 0,
    connXLeft: 0,
  };

  for (let i = anchorIdx + 1; i < chain.length; i++) {
    const placed = chain[i];
    const isBalak = placed.isBalak;

    // Turning triggers: after M tiles going right, turn UP once, then loop LEFT
    if (rightState.dir === 'right' && rightState.tilesInDir >= M) {
      rightState.dir = 'up';
      rightState.tilesInDir = 0;
      rightState.turnRightEdgeX = rightState.connX;
    } else if (rightState.dir === 'up' && rightState.tilesInDir >= 1) {
      rightState.dir = 'left';
      rightState.tilesInDir = 0;
      rightState.connXLeft = rightState.turnRightEdgeX - 2 * u;
    }

    if (rightState.dir === 'right') {
      if (isBalak) {
        result[i] = {
          placed,
          chainIndex: i,
          x: rightState.connX,
          y: -u,
          w: u,
          h: 2 * u,
          orientation: 'vertical',
          visualFacing: placed.facing,
          isCorner: false,
        };
        rightState.connX += u;
      } else {
        result[i] = {
          placed,
          chainIndex: i,
          x: rightState.connX,
          y: -u / 2,
          w: 2 * u,
          h: u,
          orientation: 'horizontal',
          visualFacing: placed.facing,
          isCorner: false,
        };
        rightState.connX += 2 * u;
      }
      rightState.tilesInDir++;
    } else if (rightState.dir === 'up') {
      // Turn UP: flush with right edge of the horizontal run
      // Bottom of vertical tile touches the top edge of the right square of the middle row
      const vx = rightState.turnRightEdgeX - u;
      const vy = -u / 2 - 2 * u;
      if (isBalak) {
        result[i] = {
          placed,
          chainIndex: i,
          x: rightState.turnRightEdgeX - 2 * u,
          y: -u / 2 - u,
          w: 2 * u,
          h: u,
          orientation: 'horizontal',
          visualFacing: placed.facing,
          isCorner: true,
          cornerDir: 'right',
        };
        rightState.topRowY = -u / 2 - u;
      } else {
        result[i] = {
          placed,
          chainIndex: i,
          x: vx,
          y: vy,
          w: u,
          h: 2 * u,
          orientation: 'vertical',
          // Top shows facing[1] (outgoing), Bottom shows facing[0] (touches middle row)
          visualFacing: [placed.facing[1], placed.facing[0]],
          isCorner: true,
          cornerDir: 'right',
        };
        rightState.topRowY = vy;
      }
      rightState.tilesInDir++;
    } else if (rightState.dir === 'left') {
      // Loop LEFT in the top row: bottom of this row touches the top edge of the vertical turn
      const hy = rightState.topRowY - u;
      if (rightState.tilesInDir === 0) {
        // Corner horizontal tile flush with the right boundary
        const hx = rightState.turnRightEdgeX - 2 * u;
        if (isBalak) {
          result[i] = {
            placed,
            chainIndex: i,
            x: rightState.turnRightEdgeX - u,
            y: hy - u / 2,
            w: u,
            h: 2 * u,
            orientation: 'vertical',
            visualFacing: placed.facing,
            isCorner: false,
          };
          rightState.connXLeft = rightState.turnRightEdgeX - u;
        } else {
          result[i] = {
            placed,
            chainIndex: i,
            x: hx,
            y: hy,
            w: 2 * u,
            h: u,
            orientation: 'horizontal',
            // Right shows facing[0] (touches vertical tile), Left shows facing[1] (outgoing)
            visualFacing: [placed.facing[1], placed.facing[0]],
            isCorner: false,
          };
          rightState.connXLeft = hx;
        }
      } else {
        if (isBalak) {
          result[i] = {
            placed,
            chainIndex: i,
            x: rightState.connXLeft - u,
            y: hy - u / 2,
            w: u,
            h: 2 * u,
            orientation: 'vertical',
            visualFacing: placed.facing,
            isCorner: false,
          };
          rightState.connXLeft -= u;
        } else {
          result[i] = {
            placed,
            chainIndex: i,
            x: rightState.connXLeft - 2 * u,
            y: hy,
            w: 2 * u,
            h: u,
            orientation: 'horizontal',
            visualFacing: [placed.facing[1], placed.facing[0]],
            isCorner: false,
          };
          rightState.connXLeft -= 2 * u;
        }
      }
      rightState.tilesInDir++;
    }
  }

  // Calculate Right Slot (open right end)
  let rightSlot: SlotPosition;
  if (rightState.dir === 'right') {
    rightSlot = {
      x: rightState.connX + 4,
      y: -u / 2,
      w: 2 * u,
      h: u,
      orientation: 'horizontal',
    };
  } else if (rightState.dir === 'up') {
    rightSlot = {
      x: rightState.turnRightEdgeX - u,
      y: rightState.topRowY - 2 * u - 4,
      w: u,
      h: 2 * u,
      orientation: 'vertical',
    };
  } else {
    const hy = rightState.topRowY - u;
    rightSlot = {
      x: rightState.connXLeft - 2 * u - 4,
      y: hy,
      w: 2 * u,
      h: u,
      orientation: 'horizontal',
    };
  }

  // 3. Left Branch: from anchorIdx - 1 down to 0
  // Incoming pip is facing[1], outgoing pip is facing[0].
  let leftState = {
    dir: 'left' as 'left' | 'down' | 'right',
    connX: isAnchorBalak ? -u / 2 : -u,
    tilesInDir: 0,
    turnLeftEdgeX: 0,
    botRowY: 0,
    connXRight: 0,
  };

  for (let i = anchorIdx - 1; i >= 0; i--) {
    const placed = chain[i];
    const isBalak = placed.isBalak;

    // Turning triggers: after M tiles going left, turn DOWN once, then loop RIGHT
    if (leftState.dir === 'left' && leftState.tilesInDir >= M) {
      leftState.dir = 'down';
      leftState.tilesInDir = 0;
      leftState.turnLeftEdgeX = leftState.connX;
    } else if (leftState.dir === 'down' && leftState.tilesInDir >= 1) {
      leftState.dir = 'right';
      leftState.tilesInDir = 0;
      leftState.connXRight = leftState.turnLeftEdgeX + 2 * u;
    }

    if (leftState.dir === 'left') {
      if (isBalak) {
        result[i] = {
          placed,
          chainIndex: i,
          x: leftState.connX - u,
          y: -u,
          w: u,
          h: 2 * u,
          orientation: 'vertical',
          visualFacing: placed.facing,
          isCorner: false,
        };
        leftState.connX -= u;
      } else {
        result[i] = {
          placed,
          chainIndex: i,
          x: leftState.connX - 2 * u,
          y: -u / 2,
          w: 2 * u,
          h: u,
          orientation: 'horizontal',
          visualFacing: placed.facing,
          isCorner: false,
        };
        leftState.connX -= 2 * u;
      }
      leftState.tilesInDir++;
    } else if (leftState.dir === 'down') {
      // Turn DOWN: flush with left edge of the horizontal run
      // Top of vertical tile touches the bottom edge of the left square of the middle row
      const vx = leftState.turnLeftEdgeX;
      const vy = u / 2;
      if (isBalak) {
        result[i] = {
          placed,
          chainIndex: i,
          x: leftState.turnLeftEdgeX,
          y: u / 2,
          w: 2 * u,
          h: u,
          orientation: 'horizontal',
          visualFacing: placed.facing,
          isCorner: true,
          cornerDir: 'left',
        };
        leftState.botRowY = u / 2 + u;
      } else {
        result[i] = {
          placed,
          chainIndex: i,
          x: vx,
          y: vy,
          w: u,
          h: 2 * u,
          orientation: 'vertical',
          // Top shows facing[1] (matches horizontal tile end), Bottom shows facing[0] (outgoing)
          visualFacing: [placed.facing[1], placed.facing[0]],
          isCorner: true,
          cornerDir: 'left',
        };
        leftState.botRowY = vy + 2 * u;
      }
      leftState.tilesInDir++;
    } else if (leftState.dir === 'right') {
      // Loop RIGHT in the bottom row: top of this row touches the bottom edge of the vertical turn
      const hy = leftState.botRowY;
      if (leftState.tilesInDir === 0) {
        const hx = leftState.turnLeftEdgeX;
        if (isBalak) {
          result[i] = {
            placed,
            chainIndex: i,
            x: hx,
            y: hy - u / 2,
            w: u,
            h: 2 * u,
            orientation: 'vertical',
            visualFacing: placed.facing,
            isCorner: false,
          };
          leftState.connXRight = hx + u;
        } else {
          result[i] = {
            placed,
            chainIndex: i,
            x: hx,
            y: hy,
            w: 2 * u,
            h: u,
            orientation: 'horizontal',
            // Left shows facing[1] (touches vertical tile), Right shows facing[0] (outgoing)
            visualFacing: [placed.facing[1], placed.facing[0]],
            isCorner: false,
          };
          leftState.connXRight = hx + 2 * u;
        }
      } else {
        if (isBalak) {
          result[i] = {
            placed,
            chainIndex: i,
            x: leftState.connXRight,
            y: hy - u / 2,
            w: u,
            h: 2 * u,
            orientation: 'vertical',
            visualFacing: placed.facing,
            isCorner: false,
          };
          leftState.connXRight += u;
        } else {
          result[i] = {
            placed,
            chainIndex: i,
            x: leftState.connXRight,
            y: hy,
            w: 2 * u,
            h: u,
            orientation: 'horizontal',
            visualFacing: [placed.facing[1], placed.facing[0]],
            isCorner: false,
          };
          leftState.connXRight += 2 * u;
        }
      }
      leftState.tilesInDir++;
    }
  }

  // Calculate Left Slot (open left end)
  let leftSlot: SlotPosition;
  if (leftState.dir === 'left') {
    leftSlot = {
      x: leftState.connX - 2 * u - 4,
      y: -u / 2,
      w: 2 * u,
      h: u,
      orientation: 'horizontal',
    };
  } else if (leftState.dir === 'down') {
    leftSlot = {
      x: leftState.turnLeftEdgeX,
      y: leftState.botRowY + 4,
      w: u,
      h: 2 * u,
      orientation: 'vertical',
    };
  } else {
    leftSlot = {
      x: leftState.connXRight + 4,
      y: leftState.botRowY,
      w: 2 * u,
      h: u,
      orientation: 'horizontal',
    };
  }

  // Calculate content bounding box
  const allX = result.map((t) => t.x);
  const allY = result.map((t) => t.y);
  let minX = Math.min(...allX, leftSlot.x, rightSlot.x);
  let maxX = Math.max(...result.map((t) => t.x + t.w), leftSlot.x + leftSlot.w, rightSlot.x + rightSlot.w);
  let minY = Math.min(...allY, leftSlot.y, rightSlot.y);
  let maxY = Math.max(...result.map((t) => t.y + t.h), leftSlot.y + leftSlot.h, rightSlot.y + rightSlot.h);

  return {
    tiles: result,
    leftSlot,
    rightSlot,
    bounds: { minX, maxX, minY, maxY },
  };
}

export const GameBoard: React.FC<GameBoardProps> = ({
  board,
  onSelectEnd,
  selectableEnds = [],
  drawPoolCount,
  onDraw,
  canDraw = false,
}) => {
  const { chain, leftEnd, rightEnd } = board;
  const containerRef = useRef<HTMLDivElement>(null);

  // Monitor container dimensions for automatic responsive scaling
  const [containerSize, setContainerSize] = useState({ width: 700, height: 380 });

  useEffect(() => {
    if (!containerRef.current) return;
    let rafId: number;
    const updateSize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (containerRef.current) {
          setContainerSize({
            width: containerRef.current.clientWidth || 700,
            height: containerRef.current.clientHeight || 380,
          });
        }
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  // Choose optimal M (horizontal tiles per row) and base unit u based on container width
  const { M, u } = useMemo(() => {
    const w = containerSize.width;
    if (w < 480) return { M: 3, u: 26 };
    if (w < 720) return { M: 4, u: 30 };
    if (w < 1000) return { M: 4, u: 34 };
    return { M: 5, u: 36 };
  }, [containerSize.width]);

  // Compute snake layout
  const { tiles, leftSlot, rightSlot, bounds } = useMemo(
    () => computeSnakeLayout(chain, M, u),
    [chain, M, u]
  );

  // Calculate dynamic scale so entire board fits without scrolling
  const { stageWidth, stageHeight, scale } = useMemo(() => {
    const stageW = bounds.maxX - bounds.minX;
    const stageH = bounds.maxY - bounds.minY;

    // Safety margins: account for rounded wooden border (radius 36-60px), top info bar, and bottom cangkul deck
    const padX = containerSize.width < 500 ? 56 : 84;
    const padY = containerSize.width < 500 ? 76 : 90;

    const availW = Math.max(160, containerSize.width - padX * 2);
    const availH = Math.max(160, containerSize.height - padY);

    const scaleX = availW / Math.max(1, stageW);
    const scaleY = availH / Math.max(1, stageH);

    // Initial zoom up to 1.15x for small hands on desktop/tablet, then smooth scale-down as chain grows
    const maxScale = chain.length <= 4 && containerSize.width >= 700 ? 1.15 : 1.0;
    const calculatedScale = Math.min(maxScale, scaleX, scaleY);

    return {
      stageWidth: stageW,
      stageHeight: stageH,
      scale: Math.max(0.2, calculatedScale), // smooth scaling down to 0.2 without clipping
    };
  }, [bounds, containerSize, chain.length]);

  const showLeftAction = selectableEnds.includes('left');
  const showRightAction = selectableEnds.includes('right');

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 min-h-[290px] max-h-[540px] h-[320px] sm:h-[380px] md:h-[440px] bg-gradient-to-b from-[#064e3b] via-[#043d2f] to-[#022c22] rounded-[24px] sm:rounded-[36px] md:rounded-[60px] border-[5px] sm:border-[8px] md:border-[12px] border-[#381e11] ring-2 ring-amber-800/40 ring-inset shadow-[inset_0_14px_30px_rgba(0,0,0,0.85),0_15px_30px_rgba(0,0,0,0.6)] flex items-center justify-center p-1.5 sm:p-2 md:p-4 overflow-hidden select-none"
    >
      {/* Authentic Green Felt Texture Pattern */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at center, #10b981 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Table Info Bar */}
      <div className="absolute top-2 left-2 right-2 sm:top-2.5 sm:left-3 sm:right-3 flex items-center justify-between text-[11px] sm:text-xs md:text-sm text-emerald-200/80 font-medium z-20 pointer-events-none">
        <div className="flex items-center gap-1 sm:gap-1.5 bg-emerald-950/80 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border border-emerald-800/60 shadow-md backdrop-blur-xs">
          <span>Kiri:</span>
          <span className="font-extrabold text-amber-300 text-xs sm:text-sm">
            {leftEnd !== null ? leftEnd : '-'}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-emerald-950/80 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border border-emerald-800/60 shadow-md backdrop-blur-xs">
          <Sparkles size={12} className="text-amber-400" />
          <span className="hidden sm:inline">Total Meja:</span>
          <span className="sm:hidden">Meja:</span>
          <span className="font-extrabold text-emerald-100">{chain.length}</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 bg-emerald-950/80 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border border-emerald-800/60 shadow-md backdrop-blur-xs">
          <span>Kanan:</span>
          <span className="font-extrabold text-amber-300 text-xs sm:text-sm">
            {rightEnd !== null ? rightEnd : '-'}
          </span>
        </div>
      </div>

      {/* Empty Board State */}
      {chain.length === 0 ? (
        <button
          type="button"
          onClick={() => selectableEnds.length > 0 && onSelectEnd?.('left')}
          disabled={selectableEnds.length === 0}
          className={`flex flex-col items-center gap-2 sm:gap-3 text-center z-10 transition-transform ${
            selectableEnds.length > 0
              ? 'cursor-pointer hover:scale-105 active:scale-95'
              : 'cursor-default'
          }`}
        >
          <div
            className={`w-14 h-24 sm:w-18 sm:h-30 md:w-22 md:h-34 border-2 border-dashed rounded-xl flex items-center justify-center transition-all ${
              selectableEnds.length > 0
                ? 'border-amber-400 bg-amber-500/25 shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse'
                : 'border-emerald-600/30 bg-emerald-900/20 text-emerald-500/40'
            }`}
          >
            <span className="text-3xl sm:text-4xl">🁆</span>
          </div>
          <p className="text-xs sm:text-sm font-bold tracking-wide text-amber-200">
            {selectableEnds.length > 0
              ? '✨ Pasang Kartu Pertama di Sini'
              : 'Meja Masih Kosong'}
          </p>
          <p className="text-[10px] sm:text-xs text-emerald-400/60 max-w-xs px-2">
            {selectableEnds.length > 0
              ? 'Sentuh untuk meletakkan kartu pilihan Anda ke meja'
              : 'Pemain pertama bebas memilih kartu pembuka'}
          </p>
        </button>
      ) : (
        /* Domino Felt Stage (Physical Snake Canvas) */
        <div className="flex items-center justify-center w-full h-full pointer-events-auto">
          <div
            className="relative transition-all duration-300 ease-out origin-center shrink-0"
            style={{
              width: `${stageWidth}px`,
              height: `${stageHeight}px`,
              transform: `scale(${scale})`,
            }}
          >
            {/* Left End Placement Button (Slot before Tile 0) */}
            {showLeftAction && (
              <button
                type="button"
                onClick={() => onSelectEnd?.('left')}
                style={{
                  position: 'absolute',
                  left: `${leftSlot.x - bounds.minX}px`,
                  top: `${leftSlot.y - bounds.minY}px`,
                  width: `${leftSlot.w}px`,
                  height: `${leftSlot.h}px`,
                }}
                className="z-30 rounded-lg md:rounded-xl border-2 border-dashed border-amber-300 bg-amber-500/35 hover:bg-amber-500/55 hover:scale-105 active:scale-95 text-amber-200 font-extrabold text-xs shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse transition flex items-center justify-center gap-1 cursor-pointer backdrop-blur-xs ring-1 ring-amber-400/40"
                title={`Pasang di ujung kiri (${leftEnd})`}
              >
                <ArrowLeft size={14} className="text-amber-200 shrink-0" />
                <span className="text-[10px] md:text-xs leading-none">Kiri ({leftEnd})</span>
              </button>
            )}

            {/* Placed Domino Tiles (100% Physically Connected, Zero Overlap) */}
            {tiles.map((item) => {
              const posX = item.x - bounds.minX;
              const posY = item.y - bounds.minY;

              return (
                <div
                  key={`domino-${item.chainIndex}-${item.placed.tile[0]}-${item.placed.tile[1]}`}
                  style={{
                    position: 'absolute',
                    left: `${posX}px`,
                    top: `${posY}px`,
                    width: `${item.w}px`,
                    height: `${item.h}px`,
                  }}
                  className="transition-transform duration-200 hover:scale-105 hover:z-20 p-[0.5px]"
                >
                  <DominoTile
                    tile={item.visualFacing}
                    orientation={item.orientation}
                    style={{ width: '100%', height: '100%' }}
                  />

                  {/* Balak (Double Tile) Golden Distinction */}
                  {item.placed.isBalak && (
                    <div className="absolute inset-0.5 rounded-lg border-2 border-amber-400/70 pointer-events-none shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                  )}
                </div>
              );
            })}

            {/* Right End Placement Button (Slot at open tail) */}
            {showRightAction && (
              <button
                type="button"
                onClick={() => onSelectEnd?.('right')}
                style={{
                  position: 'absolute',
                  left: `${rightSlot.x - bounds.minX}px`,
                  top: `${rightSlot.y - bounds.minY}px`,
                  width: `${rightSlot.w}px`,
                  height: `${rightSlot.h}px`,
                }}
                className="z-30 rounded-lg md:rounded-xl border-2 border-dashed border-amber-300 bg-amber-500/35 hover:bg-amber-500/55 hover:scale-105 active:scale-95 text-amber-200 font-extrabold text-xs shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse transition flex flex-col md:flex-row items-center justify-center gap-1 cursor-pointer backdrop-blur-xs ring-1 ring-amber-400/40"
                title={`Pasang di ujung kanan (${rightEnd})`}
              >
                <ArrowRight size={14} className="text-amber-200 shrink-0" />
                <span className="text-[10px] md:text-xs leading-none">Kanan ({rightEnd})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Target Choice Interactive Banner */}
      {selectableEnds.length > 0 && (
        <div className="absolute bottom-2.5 z-40 flex items-center gap-2 bg-slate-950/90 border border-amber-500/50 p-1.5 px-3 rounded-2xl shadow-2xl backdrop-blur-md animate-fade-in">
          <span className="text-xs text-amber-300 font-semibold hidden sm:inline">Pilih Sisi:</span>
          {selectableEnds.includes('left') && (
            <button
              type="button"
              onClick={() => onSelectEnd?.('left')}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl shadow-lg transition active:scale-95 cursor-pointer ring-1 ring-amber-300"
            >
              <ArrowLeft size={14} />
              <span>Pasang Kiri {leftEnd !== null ? `(${leftEnd})` : ''}</span>
            </button>
          )}
          {selectableEnds.includes('right') && (
            <button
              type="button"
              onClick={() => onSelectEnd?.('right')}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl shadow-lg transition active:scale-95 cursor-pointer ring-1 ring-amber-300"
            >
              <span>Pasang Kanan {rightEnd !== null ? `(${rightEnd})` : ''}</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* Physical Cangkul Card Stack on Table (Bottom Right) */}
      {typeof drawPoolCount === 'number' && (
        <div className="absolute bottom-3 right-4 md:bottom-4 md:right-6 z-20">
          <CangkulDeck
            count={drawPoolCount}
            isActionable={canDraw}
            onDraw={onDraw}
            size="sm"
          />
        </div>
      )}
    </div>
  );
};
