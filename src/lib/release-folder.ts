import {addDeadlineDays} from './technical-rules';
import type {TechnicalRelease} from './types';
export type ReleaseFolder={sent_date:string;sent_by:string;sent_recorded_at:string;recipient:string;received_date?:string;received_by?:string;received_recorded_at?:string};
export function releaseFolderDeadlines(release:Pick<TechnicalRelease,'release_date'|'folder_handoff'>,holidays:{date:string}[]=[]){
 const h=release.folder_handoff;
 return {sendDue:addDeadlineDays({startDate:release.release_date.slice(0,10),days:3,unit:'dias_uteis',holidays}),issueDue:h?.received_date?addDeadlineDays({startDate:h.received_date,days:5,unit:'dias_uteis',holidays}):null,status:h?.received_date?'received':h?.sent_date?'sent':'pending'};
}
