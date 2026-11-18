export function physicalPieces<T extends {complements_piece_id?:string|null}>(pieces:T[]):T[]{
 return pieces.filter(p=>!p.complements_piece_id);
}
