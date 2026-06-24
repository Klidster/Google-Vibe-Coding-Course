import sys
sys.stdout.reconfigure(encoding='utf-8')

path = 'tests/integration/smoke_test.py'
with open(path, encoding='utf-8') as f:
    src = f.read()

# Replace box-drawing dash (U+2500) with plain hyphen
src = src.replace('\u2500', '-')

# Inject UTF-8 stdout reconfiguration right after the first 'async def main():' line
old = 'async def main():\n'
new = 'async def main():\n    sys.stdout.reconfigure(encoding="utf-8")\n'
src = src.replace(old, new, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)

print('Done')
