#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import hashlib, hmac, json, time, urllib.request, datetime
CFG=Path.home()/'.config/ju'
PRECALL_SECRET=(CFG/'jessie-webhook-secret').read_text().strip()
POSTCALL_SECRET=(CFG/'elevenlabs-postcall-webhook-secret').read_text().strip()
UPSTREAM='http://127.0.0.1:8766'
# Append-only delivery proof: one JSON object per webhook request, so a live
# provider delivery (source IP, auth verdict, upstream status, payload hash)
# can be proven after the fact without trusting a console screenshot.
DLOG=Path.home()/'JU-Call-Transcriber'/'customer_memory'/'relay-delivery.jsonl'

def _now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')

def record(entry):
    try:
        with DLOG.open('a') as h:
            h.write(json.dumps(entry, sort_keys=True)+'\n')
    except Exception:
        pass

def valid_elevenlabs_signature(raw, header):
    if not header or not POSTCALL_SECRET: return False
    try:
        parts=dict(x.split('=',1) for x in header.split(','))
        ts=parts['t']; sig=parts['v0']
        if abs(time.time()-int(ts)) > 1800: return False
        msg=ts.encode()+b'.'+raw
        expected=hmac.new(POSTCALL_SECRET.encode(),msg,hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected,sig)
    except Exception:
        return False

def payload_facts(raw):
    facts={}
    try:
        d=json.loads(raw or b'{}')
    except Exception:
        facts['json_valid']=False
        return facts
    facts['json_valid']=True
    if not isinstance(d,dict): return facts
    inner=d.get('data') if isinstance(d.get('data'),dict) else {}
    for key,val in (
        ('payload_type', d.get('type')),
        ('caller_id', d.get('caller_id') or d.get('phone')),
        ('conversation_id', d.get('conversation_id') or inner.get('conversation_id')),
        ('agent_id', inner.get('agent_id')),
    ):
        if val: facts[key]=str(val)[:80]
    md=inner.get('metadata') if isinstance(inner.get('metadata'),dict) else {}
    if md.get('caller_id'): facts['metadata_caller_id']=str(md['caller_id'])[:32]
    return facts

class H(BaseHTTPRequestHandler):
    def sendj(self,obj,code=200):
        b=json.dumps(obj).encode(); self.send_response(code)
        self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b)))
        self.end_headers(); self.wfile.write(b)
    def pre_auth(self):
        got=self.headers.get('x-ju-webhook-secret','')
        return bool(got) and hmac.compare_digest(got,PRECALL_SECRET)
    def base_entry(self,path):
        e={'at':_now(),'event':'webhook_delivery','path':path,
           'remote':self.client_address[0] if self.client_address else '',
           'host':self.headers.get('Host',''),
           'forwarded_for':self.headers.get('X-Forwarded-For',''),
           'cf_connecting_ip':self.headers.get('Cf-Connecting-Ip',''),
           'user_agent':(self.headers.get('User-Agent','') or '')[:120],
           'marker':(self.headers.get('X-JU-Acceptance','') or '')[:64]}
        return e
    def deliver(self,entry,obj,code):
        entry['status']=code
        self.sendj(obj,code)
        record(entry)
        return None
    def do_GET(self):
        if self.path=='/health': return self.sendj({'ok':True,'service':'JU Jessie ElevenLabs Relay'})
        e=self.base_entry(self.path)
        e['auth']='none'; e['outcome']='rejected'
        return self.deliver(e,{'ok':False,'error':'not found'},404)
    def proxy_sbos(self):
        a=self.path.split('/')[-1]
        if self.path != '/api/v1/jessie/integration/'+a or a not in ('lookup-client','capture-lead','appointment-request','transfer-call','callback-message','call-outcome','business-information'): return self.sendj({'error':'not found'},404)
        secret=self.headers.get('x-sbos-agent-secret','')
        if not secret or len(secret)>512: return self.sendj({'error':'unauthorized'},401)
        try: n=int(self.headers.get('Content-Length','0'))
        except ValueError: return self.sendj({'error':'bad length'},400)
        if n<0 or n>65536: return self.sendj({'error':'too large'},413)
        req=urllib.request.Request('http://127.0.0.1:4000'+self.path,data=self.rfile.read(n),method='POST',headers={'Content-Type':'application/json','x-sbos-agent-secret':secret})
        try:
            with urllib.request.urlopen(req,timeout=10) as r: code,body=r.status,r.read()
        except urllib.error.HTTPError as e: code,body=e.code,e.read()
        except Exception: return self.sendj({'error':'upstream unavailable'},502)
        self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_POST(self):
        if self.path.startswith("/api/v1/jessie/integration/"): return self.proxy_sbos()
        if self.path not in ('/pre-call','/post-call'):
            e=self.base_entry(self.path); e['auth']='none'; e['outcome']='rejected'
            return self.deliver(e,{'ok':False,'error':'not found'},404)
        try:
            n=int(self.headers.get('Content-Length','0'))
            if n<0 or n>1048576: return self.sendj({'ok':False,'error':'payload too large'},413)
        except ValueError: return self.sendj({'ok':False,'error':'invalid length'},400)
        raw=self.rfile.read(n)
        e=self.base_entry(self.path)
        e['bytes']=n
        e['sha256']=hashlib.sha256(raw).hexdigest()
        e.update(payload_facts(raw))
        e['t0']=time.time()
        if self.path=='/pre-call':
            if not self.pre_auth():
                e['auth']='pre_call_secret_rejected'; e['outcome']='rejected'
                return self.deliver(e,{'ok':False,'error':'unauthorized'},401)
            e['auth']='pre_call_secret_ok'
        else:
            if not valid_elevenlabs_signature(raw,self.headers.get('ElevenLabs-Signature','')):
                e['auth']='postcall_signature_rejected'; e['outcome']='rejected'
                return self.deliver(e,{'ok':False,'error':'invalid signature'},401)
            e['auth']='postcall_signature_ok'
        try:
            json.loads(raw or b'{}')
        except Exception:
            e['outcome']='rejected'
            return self.deliver(e,{'ok':False,'error':'invalid json'},400)
        req=urllib.request.Request(UPSTREAM+self.path,data=raw,method='POST',headers={'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req,timeout=10) as r:
                body=r.read(); e['outcome']='forwarded'; e['status']=r.status; e['upstream_status']=r.status
                e['latency_ms']=int((time.time()-e['t0'])*1000)
                self.send_response(r.status); self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
                record(e)
        except urllib.error.HTTPError as ex:
            e['outcome']='upstream_rejected'; e['upstream_status']=ex.code
            return self.deliver(e,{'ok':False,'error':'upstream rejected request'},ex.code)
        except Exception as ex:
            e['outcome']='upstream_failure'; e['status']=502; e['error']=type(ex).__name__
            e['latency_ms']=int((time.time()-e['t0'])*1000)
            self.sendj({'ok':False,'error':'upstream failure'},502)
            record(e)
    def log_message(self,*a): pass
if __name__=='__main__': ThreadingHTTPServer(('127.0.0.1',int(__import__('os').environ.get('JU_RELAY_PORT','8767'))),H).serve_forever()
