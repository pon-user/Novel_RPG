"""Regenerate data.js from game-data.json without the original Python trial model."""
import json
from pathlib import Path
P=Path(__file__).resolve().parent
config=json.loads((P/'game-data.json').read_text(encoding='utf-8'))
(P/'data.js').write_text('window.GAME_DATA = '+json.dumps(config,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print('Regenerated data.js from game-data.json')
