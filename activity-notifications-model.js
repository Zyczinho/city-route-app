// Social notification labels are generic: never leak private message text in OS notifications.
export const ACTIVITY_KINDS={
 direct_message:{label:'Nowa wiadomość prywatna',detail:'Znajomy wysłał Ci wiadomość.'},
 group_message:{label:'Nowa wiadomość grupowa',detail:'W Twojej grupie pojawiła się wiadomość.'},
 friend_request:{label:'Zaproszenie do znajomych',detail:'Ktoś chce dodać Cię do znajomych.'},
 friend_accepted:{label:'Zaproszenie zaakceptowane',detail:'Możecie już wysyłać sobie wiadomości.'}
};
const path=/^#routes\/community\/(?:dm\/[0-9a-f-]{36}|chat\/[0-9a-f-]{36}|friends)$/i;
export function activityTarget(value){return typeof value==='string'&&path.test(value)?value:'#routes/community/notifications';}
export function activityUnreadCount(rows){return (rows||[]).filter(r=>r&&r.read_at==null).length;}
export function activityLabel(kind){return ACTIVITY_KINDS[kind]||{label:'Aktywność City Route',detail:'Masz nową aktywność.'};}
