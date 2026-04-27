import re, os

with open(r'c:\my_stuff\ftc\Schedule_SpeedRun.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

style_m = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
body_m  = re.search(r'<body>(.*?)</body>', content, re.DOTALL)

if style_m and body_m:
    style = style_m.group(1).strip()
    body  = body_m.group(1).strip()
    fm    = '---\nlayout: page\ntitle: "FTC Speed-Run Schedule"\n---\n\n'
    out   = fm + '<style>' + style + '</style>\n\n' + body + '\n'
    os.makedirs(r'c:\my_stuff\ftc\website\schedule', exist_ok=True)
    with open(r'c:\my_stuff\ftc\website\schedule\index.html', 'w', encoding='utf-8') as f:
        f.write(out)
    print(f'Written. Style: {len(style)} chars, Body: {len(body)} chars')
else:
    print('regex match failed', bool(style_m), bool(body_m))
