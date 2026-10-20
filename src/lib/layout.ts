/**
 * Reparto de eventos que se solapan, al estilo de Google Calendar.
 *
 * Un evento recibe una columna dentro de su "grupo de solapamiento" (todos los
 * eventos conectados entre sí por solapamientos, aunque sea en cadena) y todos
 * los eventos del grupo se reparten el ancho a partes iguales.
 *
 *  ┌──────┬──────┬──────┐
 *  │  A   │  B   │  C   │   A 08-10, B 09-11, C 10-12 → un solo grupo
 *  └──────┴──────┴──────┘
 */

export interface TimeSpan {
  /** Minutos desde el inicio del día. */
  start: number
  /** Minutos desde el inicio del día. */
  end: number
}

export interface Positioned<T> {
  item: T
  /** Columna 0-based dentro del grupo. */
  column: number
  /** Total de columnas del grupo; el ancho de cada una es 1/columns. */
  columns: number
}

export function layoutOverlaps<T extends TimeSpan>(
  items: readonly T[],
): Positioned<T>[] {
  if (items.length === 0) return []

  // Primero por inicio; a igual inicio, primero el más largo.
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)

  const out: Positioned<T>[] = []
  let cluster: T[] = []
  let clusterEnd = -Infinity

  const flush = () => {
    if (cluster.length === 0) return

    // Reparto voraz: cada evento va a la primera columna que ya haya quedado libre.
    const columnEnds: number[] = []
    const assigned = new Map<T, number>()

    for (const item of cluster) {
      let column = columnEnds.findIndex((end) => end <= item.start)
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(item.end)
      } else {
        columnEnds[column] = item.end
      }
      assigned.set(item, column)
    }

    const total = columnEnds.length
    for (const item of cluster) {
      out.push({ item, column: assigned.get(item) ?? 0, columns: total })
    }

    cluster = []
    clusterEnd = -Infinity
  }

  for (const item of sorted) {
    // Si empieza cuando ya terminó todo el grupo, se cierra el grupo.
    if (cluster.length > 0 && item.start >= clusterEnd) flush()

    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()

  return out
}
