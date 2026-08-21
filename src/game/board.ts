import { INIT_COLOR_COUNT, INIT_ROWS, MATCH_MIN, rndColor } from "./config"
import type { Layout } from "./layout"
import type {
  FloatingGroupResult,
  GridParity,
  GridPos,
  ResolveResult,
  ResolvedBubble,
  VolleyPlacement,
} from "./types"

const WORKSPACE_ROWS = 64
const WORKSPACE_STRIDE = 9
const WORKSPACE_CELLS = WORKSPACE_ROWS * WORKSPACE_STRIDE

export class Board {
  readonly rows: (number | null)[][] = []
  readonly ids: (number | null)[][] = []
  gridParity: GridParity = 0
  version = 0
  rowShiftVersion = 0
  private mutationDepth = 0
  private mutationDirty = false
  private nextId = 1
  private readonly scanQueue = new Int16Array(WORKSPACE_CELLS)
  private readonly scanResult = new Int16Array(WORKSPACE_CELLS)
  private readonly scanVisited = new Uint32Array(WORKSPACE_CELLS)
  private readonly resolveVisited = new Uint32Array(WORKSPACE_CELLS)
  private scanGeneration = 0
  private resolveGeneration = 0
  private scanCount = 0
  private nextGroupId = 1

  constructor(private readonly layout: Layout) {}

  cell(row: number, col: number): number | null {
    return this.rows[row]?.[col] ?? null
  }

  id(row: number, col: number): number | null {
    if (
      !this.layout.cellValid(row, col, this.gridParity) ||
      this.cell(row, col) === null
    )
      return null
    const rowIds =
      this.ids[row] ??
      (this.ids[row] = new Array(
        this.layout.rowCapacity(row, this.gridParity),
      ).fill(null))
    if (rowIds[col] === null || rowIds[col] === undefined)
      rowIds[col] = this.nextId++
    return rowIds[col]
  }

  set(row: number, col: number, v: number | null) {
    if (!this.layout.cellValid(row, col, this.gridParity)) return
    if (!this.rows[row])
      this.rows[row] = new Array(
        this.layout.rowCapacity(row, this.gridParity),
      ).fill(null)
    if (!this.ids[row])
      this.ids[row] = new Array(
        this.layout.rowCapacity(row, this.gridParity),
      ).fill(null)
    if (this.rows[row][col] === v) {
      if (v !== null) this.id(row, col)
      return
    }
    this.rows[row][col] = v
    this.ids[row][col] = v === null ? null : this.nextId++
    if (this.mutationDepth > 0) this.mutationDirty = true
    else this.version++
  }

  /** Apply a logical board mutation as one render-visible version change. */
  beginBatch() {
    this.mutationDepth++
  }

  endBatch() {
    this.mutationDepth--
    if (this.mutationDepth === 0 && this.mutationDirty) {
      this.mutationDirty = false
      this.version++
    }
  }

  batch<T,>(fn: () => T): T {
    this.beginBatch()
    try {
      return fn()
    } finally {
      this.endBatch()
    }
  }

  fillInitial(rows: number = INIT_ROWS, colors: number = INIT_COLOR_COUNT) {
    this.rows.length = 0
    this.ids.length = 0
    this.gridParity = 0
    for (let row = 0; row < rows; row++) {
      this.rows[row] = new Array(
        this.layout.rowCapacity(row, this.gridParity),
      ).fill(null)
      this.ids[row] = new Array(
        this.layout.rowCapacity(row, this.gridParity),
      ).fill(null)
      for (
        let col = 0;
        col < this.layout.rowCapacity(row, this.gridParity);
        col++
      )
        this.rows[row][col] = rndColor(colors)
      for (
        let col = 0;
        col < this.layout.rowCapacity(row, this.gridParity);
        col++
      )
        this.ids[row][col] = this.nextId++
    }
    this.version++
  }

  spawnTopRow(colors: number = INIT_COLOR_COUNT) {
    this.ensureIds()
    const nextParity = (this.gridParity ^ 1) as GridParity
    const newRow: (number | null)[] = new Array(
      this.layout.rowCapacity(0, nextParity),
    ).fill(null)
    const newIds: (number | null)[] = new Array(
      this.layout.rowCapacity(0, nextParity),
    ).fill(null)
    for (let col = 0; col < this.layout.rowCapacity(0, nextParity); col++) {
      if (Math.random() > 0.18) {
        newRow[col] = rndColor(colors)
        newIds[col] = this.nextId++
      }
    }
    this.gridParity = nextParity
    this.rows.unshift(newRow)
    this.ids.unshift(newIds)
    this.version++
    this.rowShiftVersion++
  }

  private ensureIds() {
    this.ids.length = this.rows.length
    for (let row = 0; row < this.rows.length; row++) {
      const rowIds =
        this.ids[row] ??
        (this.ids[row] = new Array(
          this.layout.rowCapacity(row, this.gridParity),
        ).fill(null))
      for (
        let col = 0;
        col < this.layout.rowCapacity(row, this.gridParity);
        col++
      ) {
        rowIds[col] =
          this.rows[row]?.[col] === null || this.rows[row]?.[col] === undefined
            ? null
            : (rowIds[col] ?? this.nextId++)
      }
    }
  }

  private nextScanGeneration() {
    this.scanGeneration = (this.scanGeneration + 1) >>> 0
    if (this.scanGeneration === 0) {
      this.scanVisited.fill(0)
      this.scanGeneration = 1
    }
    return this.scanGeneration
  }

  private nextResolveGeneration() {
    this.resolveGeneration = (this.resolveGeneration + 1) >>> 0
    if (this.resolveGeneration === 0) {
      this.resolveVisited.fill(0)
      this.resolveGeneration = 1
    }
    return this.resolveGeneration
  }

  private encode(row: number, col: number) {
    return row * WORKSPACE_STRIDE + col
  }

  resultRow(index: number) {
    return (this.scanResult[index] / WORKSPACE_STRIDE) | 0
  }

  resultCol(index: number) {
    const cell = this.scanResult[index]
    return cell - ((cell / WORKSPACE_STRIDE) | 0) * WORKSPACE_STRIDE
  }

  private enqueueColor(
    row: number,
    col: number,
    color: number,
    generation: number,
    tail: number,
  ) {
    if (
      row < 0 ||
      row >= WORKSPACE_ROWS ||
      !this.layout.cellValid(row, col, this.gridParity) ||
      this.cell(row, col) !== color
    )
      return tail
    const cell = this.encode(row, col)
    if (this.scanVisited[cell] === generation) return tail
    this.scanVisited[cell] = generation
    this.scanQueue[tail] = cell
    return tail + 1
  }

  private enqueueOccupied(
    row: number,
    col: number,
    generation: number,
    tail: number,
  ) {
    if (
      row < 0 ||
      row >= WORKSPACE_ROWS ||
      !this.layout.cellValid(row, col, this.gridParity) ||
      this.cell(row, col) === null
    )
      return tail
    const cell = this.encode(row, col)
    if (this.scanVisited[cell] === generation) return tail
    this.scanVisited[cell] = generation
    this.scanQueue[tail] = cell
    return tail + 1
  }

  private enqueueFloatingComponent(
    row: number,
    col: number,
    ceilingGeneration: number,
    componentGeneration: number,
    tail: number,
  ) {
    if (
      row < 0 ||
      row >= WORKSPACE_ROWS ||
      !this.layout.cellValid(row, col, this.gridParity) ||
      this.cell(row, col) === null
    )
      return tail
    const cell = this.encode(row, col)
    if (
      this.scanVisited[cell] === ceilingGeneration ||
      this.resolveVisited[cell] === componentGeneration
    )
      return tail
    this.resolveVisited[cell] = componentGeneration
    this.scanQueue[tail] = cell
    return tail + 1
  }

  /**
   * Commits every landing in a volley against one board revision. Placement,
   * match removal, floating partitioning, and floating removal are exposed as
   * one render-visible board version change.
   */
  resolveVolley(
    actionId: number,
    expectedBoardVersion: number,
    placements: readonly VolleyPlacement[],
  ): ResolveResult {
    const emptyResult = (): ResolveResult => ({
      actionId,
      expectedBoardVersion,
      boardVersion: this.version,
      stale: true,
      placed: [],
      matched: [],
      floatingGroups: [],
    })

    if (this.version !== expectedBoardVersion || placements.length === 0)
      return emptyResult()

    const reserved = new Set<number>()
    for (const placement of placements) {
      if (
        !this.layout.cellValid(placement.row, placement.col, this.gridParity) ||
        this.cell(placement.row, placement.col) !== null
      )
        return emptyResult()
      const cell = this.encode(placement.row, placement.col)
      if (reserved.has(cell)) return emptyResult()
      reserved.add(cell)
    }

    const placed: ResolvedBubble[] = []
    const matched: ResolvedBubble[] = []
    const floatingGroups: FloatingGroupResult[] = []

    this.batch(() => {
      for (const placement of placements) {
        this.set(placement.row, placement.col, placement.c)
        const id = this.id(placement.row, placement.col)
        if (id !== null)
          placed.push({
            id,
            c: placement.c,
            row: placement.row,
            col: placement.col,
          })
      }

      const matchGeneration = this.nextResolveGeneration()
      for (const placement of placements) {
        const count = this.scanColor(placement.row, placement.col, placement.c)
        if (count < MATCH_MIN) continue
        for (let i = 0; i < count; i++) {
          const row = this.resultRow(i)
          const col = this.resultCol(i)
          this.resolveVisited[this.encode(row, col)] = matchGeneration
        }
      }

      for (let row = 0; row < this.rows.length; row++) {
        for (
          let col = 0;
          col < this.layout.rowCapacity(row, this.gridParity);
          col++
        ) {
          if (this.resolveVisited[this.encode(row, col)] !== matchGeneration)
            continue
          const c = this.cell(row, col)
          const id = this.id(row, col)
          if (c !== null && id !== null) matched.push({ id, c, row, col })
        }
      }
      for (const bubble of matched) this.set(bubble.row, bubble.col, null)

      if (!matched.length) return

      const ceilingGeneration = this.nextScanGeneration()
      let head = 0
      let tail = 0
      const topCapacity = this.layout.rowCapacity(0, this.gridParity)
      for (let col = 0; col < topCapacity; col++)
        tail = this.enqueueOccupied(0, col, ceilingGeneration, tail)
      while (head < tail) {
        const cell = this.scanQueue[head++]
        const row = (cell / WORKSPACE_STRIDE) | 0
        const col = cell - row * WORKSPACE_STRIDE
        const odd = this.layout.effectiveParity(row, this.gridParity) === 1
        tail = this.enqueueOccupied(row, col - 1, ceilingGeneration, tail)
        tail = this.enqueueOccupied(row, col + 1, ceilingGeneration, tail)
        tail = this.enqueueOccupied(
          row - 1,
          odd ? col : col - 1,
          ceilingGeneration,
          tail,
        )
        tail = this.enqueueOccupied(
          row - 1,
          odd ? col + 1 : col,
          ceilingGeneration,
          tail,
        )
        tail = this.enqueueOccupied(
          row + 1,
          odd ? col : col - 1,
          ceilingGeneration,
          tail,
        )
        tail = this.enqueueOccupied(
          row + 1,
          odd ? col + 1 : col,
          ceilingGeneration,
          tail,
        )
      }

      const componentGeneration = this.nextResolveGeneration()
      const floating: ResolvedBubble[] = []
      for (let row = 0; row < this.rows.length; row++) {
        for (
          let col = 0;
          col < this.layout.rowCapacity(row, this.gridParity);
          col++
        ) {
          const encoded = this.encode(row, col)
          if (
            this.cell(row, col) === null ||
            this.scanVisited[encoded] === ceilingGeneration ||
            this.resolveVisited[encoded] === componentGeneration
          )
            continue

          const members: ResolvedBubble[] = []
          head = 0
          tail = this.enqueueFloatingComponent(
            row,
            col,
            ceilingGeneration,
            componentGeneration,
            0,
          )
          while (head < tail) {
            const cell = this.scanQueue[head++]
            const memberRow = (cell / WORKSPACE_STRIDE) | 0
            const memberCol = cell - memberRow * WORKSPACE_STRIDE
            const c = this.cell(memberRow, memberCol)
            const id = this.id(memberRow, memberCol)
            if (c !== null && id !== null) {
              const member = { id, c, row: memberRow, col: memberCol }
              members.push(member)
              floating.push(member)
            }
            const odd =
              this.layout.effectiveParity(memberRow, this.gridParity) === 1
            tail = this.enqueueFloatingComponent(
              memberRow,
              memberCol - 1,
              ceilingGeneration,
              componentGeneration,
              tail,
            )
            tail = this.enqueueFloatingComponent(
              memberRow,
              memberCol + 1,
              ceilingGeneration,
              componentGeneration,
              tail,
            )
            tail = this.enqueueFloatingComponent(
              memberRow - 1,
              odd ? memberCol : memberCol - 1,
              ceilingGeneration,
              componentGeneration,
              tail,
            )
            tail = this.enqueueFloatingComponent(
              memberRow - 1,
              odd ? memberCol + 1 : memberCol,
              ceilingGeneration,
              componentGeneration,
              tail,
            )
            tail = this.enqueueFloatingComponent(
              memberRow + 1,
              odd ? memberCol : memberCol - 1,
              ceilingGeneration,
              componentGeneration,
              tail,
            )
            tail = this.enqueueFloatingComponent(
              memberRow + 1,
              odd ? memberCol + 1 : memberCol,
              ceilingGeneration,
              componentGeneration,
              tail,
            )
          }
          floatingGroups.push({ groupId: this.nextGroupId++, members })
        }
      }
      for (const bubble of floating) this.set(bubble.row, bubble.col, null)
    })

    return {
      actionId,
      expectedBoardVersion,
      boardVersion: this.version,
      stale: false,
      placed,
      matched,
      floatingGroups,
    }
  }

  /** Zero-allocation same-color scan. Read results through resultRow/resultCol. */
  scanColor(row: number, col: number, color: number) {
    this.scanCount = 0
    if (!this.layout.cellValid(row, col, this.gridParity)) return 0
    const generation = this.nextScanGeneration()
    let head = 0
    let tail = this.enqueueColor(row, col, color, generation, 0)
    while (head < tail) {
      const cell = this.scanQueue[head++]
      const r = (cell / WORKSPACE_STRIDE) | 0
      const c = cell - r * WORKSPACE_STRIDE
      this.scanResult[this.scanCount++] = cell
      const odd = this.layout.effectiveParity(r, this.gridParity) === 1
      tail = this.enqueueColor(r, c - 1, color, generation, tail)
      tail = this.enqueueColor(r, c + 1, color, generation, tail)
      tail = this.enqueueColor(r - 1, odd ? c : c - 1, color, generation, tail)
      tail = this.enqueueColor(r - 1, odd ? c + 1 : c, color, generation, tail)
      tail = this.enqueueColor(r + 1, odd ? c : c - 1, color, generation, tail)
      tail = this.enqueueColor(r + 1, odd ? c + 1 : c, color, generation, tail)
    }
    return this.scanCount
  }

  /** Zero-allocation ceiling-connectivity scan. */
  scanFloating() {
    this.scanCount = 0
    const generation = this.nextScanGeneration()
    let head = 0
    let tail = 0
    const topCapacity = this.layout.rowCapacity(0, this.gridParity)
    for (let col = 0; col < topCapacity; col++)
      tail = this.enqueueOccupied(0, col, generation, tail)

    while (head < tail) {
      const cell = this.scanQueue[head++]
      const r = (cell / WORKSPACE_STRIDE) | 0
      const c = cell - r * WORKSPACE_STRIDE
      const odd = this.layout.effectiveParity(r, this.gridParity) === 1
      tail = this.enqueueOccupied(r, c - 1, generation, tail)
      tail = this.enqueueOccupied(r, c + 1, generation, tail)
      tail = this.enqueueOccupied(r - 1, odd ? c : c - 1, generation, tail)
      tail = this.enqueueOccupied(r - 1, odd ? c + 1 : c, generation, tail)
      tail = this.enqueueOccupied(r + 1, odd ? c : c - 1, generation, tail)
      tail = this.enqueueOccupied(r + 1, odd ? c + 1 : c, generation, tail)
    }

    const rowCount = Math.min(this.rows.length, WORKSPACE_ROWS)
    for (let r = 0; r < rowCount; r++) {
      for (
        let col = 0;
        col < this.layout.rowCapacity(r, this.gridParity);
        col++
      ) {
        const cell = this.encode(r, col)
        if (this.cell(r, col) !== null && this.scanVisited[cell] !== generation)
          this.scanResult[this.scanCount++] = cell
      }
    }
    return this.scanCount
  }

  /** Compatibility wrapper for tests/debug. Gameplay uses scanColor(). */
  bfsColor(row: number, col: number, c: number): GridPos[] {
    const count = this.scanColor(row, col, c)
    const result: GridPos[] = []
    for (let i = 0; i < count; i++)
      result.push({ row: this.resultRow(i), col: this.resultCol(i) })
    return result
  }

  /** Compatibility wrapper for tests/debug. Gameplay uses scanFloating(). */
  findFloating(): GridPos[] {
    const count = this.scanFloating()
    const floating: GridPos[] = []
    for (let i = 0; i < count; i++)
      floating.push({ row: this.resultRow(i), col: this.resultCol(i) })
    return floating
  }

  isClear(): boolean {
    for (let r = 0; r < this.rows.length; r++) {
      for (
        let col = 0;
        col < this.layout.rowCapacity(r, this.gridParity);
        col++
      ) {
        if (this.cell(r, col) !== null) return false
      }
    }
    return true
  }
}
