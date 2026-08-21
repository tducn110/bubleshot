export interface BoardVisualCell {
  id: number
  color: number
  row: number
  col: number
}

type VisitCell = (id: number, color: number, row: number, col: number) => void

/**
 * Stable-ID board reconciliation with caller-owned generation storage. The
 * visitor form avoids allocating a cell array or Set on every board version.
 */
export function reconcilePersistentVisuals<T>(
  visitCells: (visit: VisitCell) => void,
  visuals: Map<number, T>,
  colors: Map<number, number>,
  seen: Map<number, number>,
  generation: number,
  acquire: (color: number) => T,
  release: (visual: T) => void,
  setColor: (visual: T, color: number) => void,
  syncCell: (cell: BoardVisualCell, visual: T, existed: boolean) => void,
) {
  const cell: BoardVisualCell = { id: 0, color: 0, row: 0, col: 0 }
  visitCells((id, color, row, col) => {
    seen.set(id, generation)
    let visual = visuals.get(id)
    const existed = Boolean(visual)
    if (!visual) {
      visual = acquire(color)
      visuals.set(id, visual)
      colors.set(id, color)
    } else if (colors.get(id) !== color) {
      setColor(visual, color)
      colors.set(id, color)
    }
    cell.id = id
    cell.color = color
    cell.row = row
    cell.col = col
    syncCell(cell, visual, existed)
  })
  for (const [id, visual] of visuals) {
    if (seen.get(id) === generation) continue
    visuals.delete(id)
    colors.delete(id)
    seen.delete(id)
    release(visual)
  }
}
