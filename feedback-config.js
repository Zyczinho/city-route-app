// Where "Daj znać, co poprawić" sends testers: a form (Google Forms, Tally) or an ig.me/m/<handle> DM link.
// Empty string hides every feedback entry point. Only https:// links are used.
export const FEEDBACK_URL='';

export function feedbackUrl(value=FEEDBACK_URL){
 try{const u=new URL(String(value||''));return u.protocol==='https:'?u.href:'';}catch{return '';}
}
