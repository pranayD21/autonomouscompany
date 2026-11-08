"""Read only direct-message replies for an explicitly tracked recipient after its watermark.
Input is JSON on stdin; output is JSON. Never enumerates unrelated conversations.
"""
import json, sqlite3, sys, re, os
from pathlib import Path
args = json.load(sys.stdin)
path = Path(os.environ.get('MAC_MESSAGES_DB_PATH', str(Path.home() / 'Library/Messages/chat.db')))
try:
    con = sqlite3.connect('file:' + str(path) + '?mode=ro', uri=True)
    con.execute('PRAGMA query_only=ON')
    if args['mode'] == 'check':
        con.execute('SELECT 1 FROM sqlite_master LIMIT 1').fetchone()
        print(json.dumps({'ready': True}))
    elif args['mode'] == 'watermark':
        print(json.dumps({'rowid': con.execute('SELECT COALESCE(MAX(ROWID),0) FROM message').fetchone()[0]}))
    elif args['mode'] == 'replies':
        peer = args['phone']
        transport = {'sms': 'SMS', 'imessage': 'iMessage'}[args['transport']]
        if not re.fullmatch(r'\+[1-9]\d{7,14}', peer): raise ValueError('invalid recipient')
        cursor = int(args['after'])
        con.row_factory = sqlite3.Row
        rows = con.execute('''SELECT m.ROWID AS rowid,m.guid,m.text,m.date,c.guid AS thread
          FROM message m JOIN handle h ON h.ROWID=m.handle_id
          JOIN chat_message_join cm ON cm.message_id=m.ROWID JOIN chat c ON c.ROWID=cm.chat_id
          WHERE m.ROWID>? AND m.is_from_me=0 AND h.id=? AND m.service=?
          AND (SELECT COUNT(*) FROM chat_handle_join ch WHERE ch.chat_id=c.ROWID)=1
          AND m.associated_message_type=0
          ORDER BY m.ROWID LIMIT 50''', (cursor,peer,transport)).fetchall()
        result=[]
        for row in rows:
            if not row['text']:
                # Do not guess attributed-string bytes or silently consume an unreadable reply.
                result.append({'rowid':row['rowid'],'unsupported':True})
                break
            date=row['date']
            seconds=date/1_000_000_000 if abs(date)>10_000_000_000 else date
            result.append({'rowid':row['rowid'],'guid':row['guid'],'text':row['text'],
                           'unix_ms':round((seconds+978307200)*1000),'thread':row['thread']})
        print(json.dumps({'messages':result}))
    else: raise ValueError('unsupported mode')
    con.close()
except Exception:
    # Avoid exposing DB paths, contacts, contents, or the SQL query in errors.
    print(json.dumps({'error':'MESSAGES_DATABASE_UNAVAILABLE'}))
    sys.exit(1)
