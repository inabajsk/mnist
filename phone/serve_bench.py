#!/usr/bin/env python3
"""
serve_bench.py : 計測ページ (phone/site) を LAN に配信し, ページから送られた結果を phone/native/browser_*.json に保存する
  $ python3 phone/serve_bench.py            (ポート 8765)
  スマートフォン・PC のブラウザで http://<この PC の IP>:8765/#autorun,post,dev=端末名 を開くと自動で計測して送る
"""
import http.server, json, os, re, sys, time

W = os.path.dirname(os.path.abspath(__file__))
SITE, OUT = os.path.join(W, 'site'), os.path.join(W, 'native')


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=SITE, **k)

    def do_POST(self):
        if self.path.rstrip('/').endswith('result'):
            d = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            name = re.sub(r'[^A-Za-z0-9_-]+', '_', d.get('device') or 'browser')
            # 同じ計測 (runId) の途中経過は同じファイルに上書きする
            fn = os.path.join(OUT, f'browser_{name}_{d.get("runId") or time.strftime("%Y%m%d_%H%M%S")}.json')
            os.makedirs(OUT, exist_ok=True)
            json.dump(d, open(fn, 'w'), ensure_ascii=False, indent=1)
            print('saved' if not d.get('partial') else 'partial', len(d.get('results', [])), fn, flush=True)
            self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
        else:
            self.send_error(404)


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
print(f'serving {SITE} on :{port}', flush=True)
http.server.ThreadingHTTPServer(('0.0.0.0', port), H).serve_forever()
