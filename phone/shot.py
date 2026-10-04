# 計測ページをスマートフォンの画面サイズで開き, 計測結果 (JSON) を表示させて画面写真を撮る (Chrome DevTools Protocol)
import json, subprocess, time, base64, urllib.request, sys, os
import websocket
W = os.path.dirname(os.path.abspath(__file__))
res = json.load(open(sys.argv[1]))
out = sys.argv[2]
prof = os.path.join(W, "chrome-shot")
subprocess.run(["rm", "-rf", prof])
ch = subprocess.Popen(["chromium", "--headless=new", "--no-sandbox", f"--user-data-dir={prof}", "--remote-debugging-port=9333", "--remote-allow-origins=*",
                       "--hide-scrollbars", "--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=vulkan", "--ignore-gpu-blocklist", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            tabs = json.load(urllib.request.urlopen("http://127.0.0.1:9333/json"))
            break
        except Exception:
            time.sleep(0.3)
    ws = websocket.create_connection([t for t in tabs if t["type"] == "page"][0]["webSocketDebuggerUrl"], timeout=120)
    n = [0]
    def call(method, **params):
        n[0] += 1
        ws.send(json.dumps({"id": n[0], "method": method, "params": params}))
        while True:
            m = json.loads(ws.recv())
            if m.get("id") == n[0]:
                return m.get("result", {})
    call("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=3, mobile=True)
    call("Page.enable")
    call("Page.navigate", url="http://127.0.0.1:8765/test.html")
    for _ in range(120):
        r = call("Runtime.evaluate", expression="document.getElementById('run') && !document.getElementById('run').disabled", returnByValue=True)
        if r.get("result", {}).get("value"):
            break
        time.sleep(0.5)
    js = """(() => { const R = %s; document.getElementById('device-name').value = %s;
      for (const r of R.results) { if (r.skipped) addSkip(r.method, r.skipped); else addResult(r); }
      setStatus('計測が終わり、結果を保存しました'); setProg(1); return true; })()""" % (json.dumps(res), json.dumps(sys.argv[3] if len(sys.argv) > 3 else ""))
    call("Runtime.evaluate", expression=js, returnByValue=True)
    time.sleep(0.5)
    h = call("Runtime.evaluate", expression="document.documentElement.scrollHeight", returnByValue=True)["result"]["value"]
    shot = call("Page.captureScreenshot", format="png", captureBeyondViewport=True,
                clip={"x": 0, "y": 0, "width": 390, "height": min(h, 2400), "scale": 1})
    open(out, "wb").write(base64.b64decode(shot["data"]))
    print("saved", out, "height", h)
finally:
    ch.terminate()
